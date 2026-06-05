import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SupabaseAdmin = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

type ProvisionInput = {
  user: Pick<User, "id" | "email" | "user_metadata">;
  fullName?: string | null;
  businessName?: string | null;
  businessType?: string | null;
};

export async function findAuthUserByEmail(admin: SupabaseAdmin, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (found) {
      return found;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  return null;
}

export async function ensureUserWorkspace(admin: SupabaseAdmin, input: ProvisionInput) {
  const email = input.user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Auth user email is missing");
  }

  const metadataName =
    typeof input.user.user_metadata?.full_name === "string"
      ? input.user.user_metadata.full_name
      : typeof input.user.user_metadata?.name === "string"
        ? input.user.user_metadata.name
        : null;
  const fullName = input.fullName?.trim() || metadataName || email.split("@")[0] || "BusinessHub User";

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: input.user.id,
      email,
      full_name: fullName,
      role: "user"
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw profileError;
  }

  const { data: business, error: businessLookupError } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", input.user.id)
    .limit(1)
    .maybeSingle();

  if (businessLookupError) {
    throw businessLookupError;
  }

  let businessId = (business as Database["public"]["Tables"]["businesses"]["Row"] | null)?.id ?? null;

  if (!businessId) {
    const { data: createdBusiness, error: businessError } = await admin
      .from("businesses")
      .insert({
        owner_id: input.user.id,
        name: input.businessName?.trim() || `${fullName} Business`,
        type: input.businessType?.trim() || "Другое"
      })
      .select("id")
      .single();

    if (businessError) {
      throw businessError;
    }

    businessId = (createdBusiness as Database["public"]["Tables"]["businesses"]["Row"]).id;
  }

  const { error: subscriptionError } = await admin.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan: "free",
      status: "active"
    },
    { onConflict: "business_id" }
  );

  if (subscriptionError) {
    throw subscriptionError;
  }

  return { profileId: input.user.id, businessId };
}
