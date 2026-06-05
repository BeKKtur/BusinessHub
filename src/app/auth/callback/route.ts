import { NextResponse, type NextRequest } from "next/server";
import { ensureUserWorkspace } from "@/lib/server/auth-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return redirectTo(request, "/login", { reason: "oauth" });
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth.callback.exchange]", { message: exchangeError.message });
    return redirectTo(request, "/login", { reason: "oauth" });
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[auth.callback.user]", { message: userError?.message ?? "User not found after OAuth callback" });
    return redirectTo(request, "/login", { reason: "oauth" });
  }

  try {
    await ensureUserWorkspace(createAdminClient(), { user });
  } catch (provisionError) {
    console.error("[auth.callback.provision]", {
      message: provisionError instanceof Error ? provisionError.message : "Unknown provisioning error"
    });
    return redirectTo(request, "/onboarding");
  }

  return redirectTo(request, "/dashboard");
}
