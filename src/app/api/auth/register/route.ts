import { NextResponse } from "next/server";
import type { AuthError } from "@supabase/supabase-js";
import { z } from "zod";
import { apiError, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { isSupabaseServerConfigured } from "@/lib/env";
import { ensureUserWorkspace, findAuthUserByEmail } from "@/lib/server/auth-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  businessName: z.string().trim().min(2).optional(),
  businessType: z.string().trim().min(1).default("Другое")
});

function isDuplicateAccountError(error: AuthError | null | undefined) {
  const message = error?.message.toLowerCase() ?? "";
  return message.includes("already") || message.includes("registered") || message.includes("exists") || message.includes("duplicate");
}

function publicSupabaseError(prefix: string, message?: string) {
  return message ? `${prefix}: ${message}` : prefix;
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    if (!isSupabaseServerConfigured()) {
      return supabaseConfigErrorResponse();
    }

    const payload = await parseJson(request, registerSchema);
    const admin = createAdminClient();
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.name }
    });

    if (createError || !createdUser.user) {
      const details = createError?.message ?? "Supabase Auth did not return a created user.";
      console.error("[auth.register.createUser]", { message: details });

      if (isDuplicateAccountError(createError)) {
        const existingUser = await findAuthUserByEmail(admin, payload.email);
        if (existingUser) {
          try {
            await ensureUserWorkspace(admin, {
              user: existingUser,
              fullName: payload.name,
              businessName: payload.businessName,
              businessType: payload.businessType
            });
          } catch (provisionError) {
            console.error("[auth.register.provisionExisting]", {
              message: provisionError instanceof Error ? provisionError.message : "Unknown provisioning error"
            });
            return NextResponse.json({ error: "Аккаунт найден, но не удалось подготовить рабочее пространство." }, { status: 500 });
          }
        }

        return NextResponse.json({ error: "Аккаунт с таким email уже существует. Войдите." }, { status: 409 });
      }

      return NextResponse.json({ error: publicSupabaseError("Не удалось создать аккаунт", details) }, { status: 422 });
    }

    const userId = createdUser.user.id;
    createdUserId = userId;
    try {
      await ensureUserWorkspace(admin, {
        user: createdUser.user,
        fullName: payload.name,
        businessName: payload.businessName,
        businessType: payload.businessType
      });
    } catch (provisionError) {
      const message = provisionError instanceof Error ? provisionError.message : "Unknown provisioning error";
      console.error("[auth.register.provision]", { message });
      await admin.auth.admin.deleteUser(userId);
      createdUserId = null;
      return NextResponse.json({ error: publicSupabaseError("Не удалось подготовить рабочее пространство", message) }, { status: 500 });
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (signInError) {
      console.error("[auth.register.signIn]", { message: signInError.message });
      return NextResponse.json({ error: publicSupabaseError("Аккаунт создан, но не удалось открыть сессию", signInError.message) }, { status: 201 });
    }

    return NextResponse.json({ data: { userId, nextPath: "/onboarding" } }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      try {
        await createAdminClient().auth.admin.deleteUser(createdUserId);
      } catch (cleanupError) {
        console.error("[auth.register.cleanup]", { message: cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error" });
      }
    }

    return apiError(error);
  }
}
