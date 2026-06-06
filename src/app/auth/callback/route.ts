import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvStatus } from "@/lib/env";
import { ensureUserWorkspace } from "@/lib/server/auth-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>, cookiesToSet: CookieToSet[] = []) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = NextResponse.redirect(url);
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export async function GET(request: NextRequest) {
  const cookiesToSet: CookieToSet[] = [];
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    console.error("[auth.callback.code]", { message: "OAuth callback did not include a code." });
    return redirectTo(request, "/login", { reason: "oauth" });
  }
  console.info("[auth.callback.code]", { message: "OAuth callback received code." });

  const envStatus = getSupabasePublicEnvStatus();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length || !supabaseUrl || !supabaseKey) {
    console.error("[auth.callback.env]", {
      missingEnv: envStatus.missingEnv,
      placeholderEnv: envStatus.placeholderEnv,
      invalidEnv: envStatus.invalidEnv
    });
    return redirectTo(request, "/login", { reason: "supabase" });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies: CookieToSet[]) {
        newCookies.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          cookiesToSet.push(cookie);
        });
      }
    }
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth.callback.exchange]", { message: exchangeError.message });
    return redirectTo(request, "/login", { reason: "oauth" }, cookiesToSet);
  }
  console.info("[auth.callback.exchange]", { message: "exchangeCodeForSession succeeded." });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[auth.callback.user]", { message: userError?.message ?? "User not found after OAuth callback" });
    return redirectTo(request, "/login", { reason: "oauth" }, cookiesToSet);
  }

  const admin = createAdminClient();
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    console.error("[auth.callback.email]", { message: "OAuth user email is missing" });
    return redirectTo(request, "/login", { reason: "oauth" }, cookiesToSet);
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    console.error("[auth.callback.profileLookup]", { message: existingProfileError.message });
    return redirectTo(request, "/login", { reason: "oauth" }, cookiesToSet);
  }

  if (existingProfile && existingProfile.id !== user.id) {
    console.warn("[auth.callback.duplicateEmail]", {
      message: "OAuth returned a different auth user for an email that already has a BusinessHub profile.",
      email
    });
    await supabase.auth.signOut();
    return redirectTo(request, "/login", { reason: "oauth_existing" }, cookiesToSet);
  }

  try {
    console.info("[auth.callback.provision]", {
      message: existingProfile ? "Аккаунт уже существует. Выполняем вход." : "Создаем новый аккаунт…",
      email
    });
    await ensureUserWorkspace(admin, { user });
  } catch (provisionError) {
    console.error("[auth.callback.provision]", {
      message: provisionError instanceof Error ? provisionError.message : "Unknown provisioning error"
    });
    return redirectTo(request, "/onboarding", undefined, cookiesToSet);
  }

  console.info("[auth.callback.success]", { userId: user.id, email, redirectTo: "/dashboard" });
  return redirectTo(request, "/dashboard", undefined, cookiesToSet);
}
