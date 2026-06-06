import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvStatus } from "@/lib/env";

const protectedRoutes = [
  "/dashboard",
  "/profile",
  "/clients",
  "/appointments",
  "/services",
  "/finance",
  "/analytics",
  "/telegram",
  "/billing",
  "/admin"
];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const e2eAuthBypass = process.env.E2E_AUTH_BYPASS === "true" && request.headers.get("x-businesshub-e2e-auth") === "1";

  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/callback";
    return NextResponse.redirect(redirectUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProtected = protectedRoutes.some(
    (route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
  );
  const isAuthPage = ["/login", "/register"].includes(request.nextUrl.pathname);
  const isOnboarding = request.nextUrl.pathname === "/onboarding";
  const isAdminRoute = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  if (e2eAuthBypass && (isProtected || isOnboarding)) {
    return response;
  }

  const envStatus = getSupabasePublicEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || !supabaseUrl || !supabaseKey) {
    if (isProtected || isOnboarding) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("reason", "supabase");
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if ((isProtected || isOnboarding || isAuthPage) && user) {
    const { data: profile } = await supabase.from("profiles").select("id, role, blocked").eq("id", user.id).maybeSingle();
    const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).limit(1).maybeSingle();

    if (isAuthPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = profile && business ? "/dashboard" : "/onboarding";
      return NextResponse.redirect(redirectUrl);
    }

    if (isProtected && (!profile || (!business && !isAdminRoute))) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding";
      return NextResponse.redirect(redirectUrl);
    }

    if (isProtected && profile?.blocked) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("reason", "blocked");
      return NextResponse.redirect(redirectUrl);
    }

    if (isOnboarding && profile && business) {
      return response;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
