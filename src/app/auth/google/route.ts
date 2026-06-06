import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvStatus } from "@/lib/env";
import { getClientSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

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
  const envStatus = getSupabasePublicEnvStatus();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length || !supabaseUrl || !supabaseKey) {
    console.error("[auth.google.env]", {
      missingEnv: envStatus.missingEnv,
      placeholderEnv: envStatus.placeholderEnv,
      invalidEnv: envStatus.invalidEnv,
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(supabaseKey)
    });
    return redirectTo(request, "/login", { reason: "supabase" });
  }

  const siteUrl = getClientSiteUrl();
  const redirectToUrl = `${siteUrl}/auth/callback`;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies: CookieToSet[]) {
        console.info("[auth.google.cookies.set]", {
          count: newCookies.length,
          names: newCookies.map((cookie) => cookie.name),
          hasCodeVerifierCookie: newCookies.some((cookie) => cookie.name.endsWith("-code-verifier"))
        });
        newCookies.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          cookiesToSet.push(cookie);
        });
      }
    }
  });

  console.info("[auth.google.start]", {
    requestOrigin: request.nextUrl.origin,
    redirectTo: redirectToUrl
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectToUrl
    }
  });

  if (error || !data.url) {
    console.error("[auth.google.start]", {
      ok: false,
      message: error?.message ?? "Supabase did not return Google OAuth URL."
    });
    return redirectTo(request, "/login", { reason: "oauth" }, cookiesToSet);
  }

  const response = NextResponse.redirect(data.url);
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
