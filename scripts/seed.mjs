import { createClient } from "@supabase/supabase-js";

const protectedSuperAdminEmail = "batyrbekovbektur0@gmail.com";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (user || data.users.length < 1000) {
      return user ?? null;
    }
  }

  return null;
}

async function protectSuperAdmin() {
  const user = await findUserByEmail(protectedSuperAdminEmail);
  if (!user) {
    console.log(`Protected super admin auth user not found: ${protectedSuperAdminEmail}`);
    return null;
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: protectedSuperAdminEmail,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "BusinessHub Admin",
      role: "super_admin",
      blocked: false
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }

  console.log(`Protected super admin restored: ${protectedSuperAdminEmail}`);
  return user.id;
}

async function seedDemoData() {
  const { data: demoOwner, error: ownerError } = await supabase
    .from("profiles")
    .select("id")
    .neq("email", protectedSuperAdminEmail)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    throw ownerError;
  }

  if (!demoOwner) {
    console.log("Demo seed skipped: create a non-admin test profile first.");
    return;
  }

  const demoBusinessId = "00000000-0000-4000-9000-000000000001";
  const { error: businessError } = await supabase.from("businesses").upsert(
    {
      id: demoBusinessId,
      owner_id: demoOwner.id,
      name: "Demo Beauty Studio",
      type: "Салон красоты"
    },
    { onConflict: "id" }
  );

  if (businessError) {
    throw businessError;
  }

  const { error: servicesError } = await supabase.from("services").upsert(
    [
      {
        id: "00000000-0000-4000-9000-000000000101",
        business_id: demoBusinessId,
        name: "Стрижка и укладка",
        category: "Основные",
        price: 25,
        duration_minutes: 60,
        active: true
      },
      {
        id: "00000000-0000-4000-9000-000000000102",
        business_id: demoBusinessId,
        name: "Окрашивание",
        category: "Премиум",
        price: 80,
        duration_minutes: 150,
        active: true
      }
    ],
    { onConflict: "id" }
  );

  if (servicesError) {
    throw servicesError;
  }

  const { error: clientsError } = await supabase.from("clients").upsert(
    [
      {
        id: "00000000-0000-4000-9000-000000000201",
        business_id: demoBusinessId,
        name: "Алина Морозова",
        phone: "+996 700 123 456",
        email: "alina@example.com",
        notes: "Предпочитает утренние записи",
        visits_count: 8,
        telegram: "@alina"
      },
      {
        id: "00000000-0000-4000-9000-000000000202",
        business_id: demoBusinessId,
        name: "Тимур Садыков",
        phone: "+996 555 777 222",
        email: "timur@example.com",
        notes: "VIP клиент",
        visits_count: 14,
        telegram: "@timur"
      }
    ],
    { onConflict: "id" }
  );

  if (clientsError) {
    throw clientsError;
  }

  console.log("Demo seed finished without resetting auth users or profiles.");
}

try {
  await protectSuperAdmin();
  await seedDemoData();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
