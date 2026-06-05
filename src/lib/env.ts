const supabasePublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const supabaseServerEnv = [...supabasePublicEnv, "SUPABASE_SERVICE_ROLE_KEY"] as const;
type SupabaseEnvKey = (typeof supabaseServerEnv)[number];

function isPlaceholder(value: string) {
  return value.includes("your-project") || value.startsWith("your-") || value.includes("replace-with");
}

function isInvalidSupabaseUrl(key: SupabaseEnvKey, value: string) {
  if (key !== "NEXT_PUBLIC_SUPABASE_URL") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.pathname !== "/" || !["http:", "https:"].includes(url.protocol);
  } catch {
    return true;
  }
}

function getEnvStatus(keys: readonly SupabaseEnvKey[]) {
  const missingEnv = keys.filter((key) => !process.env[key]);
  const placeholderEnv = keys.filter((key) => {
    const value = process.env[key];
    return value ? isPlaceholder(value) : false;
  });
  const invalidEnv = keys.filter((key) => {
    const value = process.env[key];
    return value ? isInvalidSupabaseUrl(key, value) : false;
  });

  return { missingEnv, placeholderEnv, invalidEnv };
}

export function getSupabasePublicEnvStatus() {
  return getEnvStatus(supabasePublicEnv);
}

export function getSupabaseServerEnvStatus() {
  return getEnvStatus(supabaseServerEnv);
}

export function isSupabasePublicConfigured() {
  const status = getSupabasePublicEnvStatus();
  return !status.missingEnv.length && !status.placeholderEnv.length && !status.invalidEnv.length;
}

export function isSupabaseServerConfigured() {
  const status = getSupabaseServerEnvStatus();
  return !status.missingEnv.length && !status.placeholderEnv.length && !status.invalidEnv.length;
}
