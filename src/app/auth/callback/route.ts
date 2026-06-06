import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvStatus } from "@/lib/env";
import { ensureUserWorkspace } from "@/lib/server/auth-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function safeAuthError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : "Unknown auth error" };
  }

  const maybeError = error as {
    name?: string;
    message?: string;
    status?: number | string;
    code?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  };

  return {
    name: maybeError.name,
    message: maybeError.message,
    status: maybeError.status,
    code: maybeError.code ?? maybeError.error_code ?? maybeError.error,
    errorDescription: maybeError.error_description
  };
}

function safeRequestContext(request: NextRequest) {
  return {
    url: `${request.nextUrl.origin}${request.nextUrl.pathname}`,
    searchParams: Array.from(request.nextUrl.searchParams.keys()),
    hasCode: request.nextUrl.searchParams.has("code"),
    hasError: request.nextUrl.searchParams.has("error"),
    error: request.nextUrl.searchParams.get("error"),
    errorDescription: request.nextUrl.searchParams.get("error_description")
  };
}

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
  console.info("[auth.callback.received]", safeRequestContext(request));

  const callbackError = request.nextUrl.searchParams.get("error");
  if (callbackError) {
    console.error("[auth.callback.providerError]", {
      error: callbackError,
      errorDescription: request.nextUrl.searchParams.get("error_description")
    });
    return redirectTo(request, "/login", { error: "oauth_callback_failed" });
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    console.error("[auth.callback.code]", { message: "OAuth callback did not include a code.", ...safeRequestContext(request) });
    return redirectTo(request, "/login", { error: "oauth_callback_failed" });
  }
  console.info("[auth.callback.code]", { message: "OAuth callback received code.", hasCode: true });

  const envStatus = getSupabasePublicEnvStatus();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length || !supabaseUrl || !supabaseKey) {
    console.error("[auth.callback.env]", {
      missingEnv: envStatus.missingEnv,
      placeholderEnv: envStatus.placeholderEnv,
      invalidEnv: envStatus.invalidEnv,
      supabaseUrlOrigin: supabaseUrl ? new URL(supabaseUrl).origin : null,
      hasAnonKey: Boolean(supabaseKey)
    });
    return redirectTo(request, "/login", { reason: "supabase", error: "oauth_callback_failed" });
  }

  console.info("[auth.callback.env]", {
    supabaseUrlOrigin: new URL(supabaseUrl).origin,
    hasAnonKey: Boolean(supabaseKey),
    missingEnv: envStatus.missingEnv,
    placeholderEnv: envStatus.placeholderEnv,
    invalidEnv: envStatus.invalidEnv
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        const cookies = request.cookies.getAll();
        console.info("[auth.callback.cookies.read]", {
          count: cookies.length,
          hasCodeVerifierCookie: cookies.some((cookie) => cookie.name.endsWith("-code-verifier"))
        });
        return cookies;
      },
      setAll(newCookies: CookieToSet[]) {
        console.info("[auth.callback.cookies.set]", {
          count: newCookies.length,
          names: newCookies.map((cookie) => cookie.name)
        });
        newCookies.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          cookiesToSet.push(cookie);
        });
      }
    }
  });

  const exchangeResult = await supabase.auth.exchangeCodeForSession(code).catch((error: unknown) => ({
    data: { session: null, user: null },
    error
  }));
  const { data: exchangeData, error: exchangeError } = exchangeResult;
  if (exchangeError) {
    console.error("[auth.callback.exchange]", {
      ok: false,
      error: safeAuthError(exchangeError),
      cookiesToSet: cookiesToSet.map((cookie) => cookie.name)
    });
    return redirectTo(request, "/login", { error: "oauth_callback_failed" }, cookiesToSet);
  }
  console.info("[auth.callback.exchange]", {
    ok: true,
    hasSession: Boolean(exchangeData.session),
    hasUser: Boolean(exchangeData.user),
    cookiesToSet: cookiesToSet.map((cookie) => cookie.name)
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[auth.callback.user]", {
      ok: false,
      error: userError ? safeAuthError(userError) : { message: "User not found after OAuth callback" }
    });
    return redirectTo(request, "/login", { error: "oauth_callback_failed" }, cookiesToSet);
  }
  console.info("[auth.callback.user]", { ok: true, userId: user.id, hasEmail: Boolean(user.email) });

  const admin = createAdminClient();
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    console.error("[auth.callback.email]", { message: "OAuth user email is missing" });
    return redirectTo(request, "/login", { error: "oauth_callback_failed" }, cookiesToSet);
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    console.error("[auth.callback.profileLookup]", { message: existingProfileError.message });
    return redirectTo(request, "/login", { error: "oauth_callback_failed" }, cookiesToSet);
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
