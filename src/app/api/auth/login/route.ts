import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { isSupabaseServerConfigured } from "@/lib/env";
import { ensureUserWorkspace, findAuthUserByEmail } from "@/lib/server/auth-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return supabaseConfigErrorResponse();
    }

    const payload = await parseJson(request, loginSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(payload);

    if (error || !data.user) {
      const admin = createAdminClient();
      const existingUser = await findAuthUserByEmail(admin, payload.email);
      if (!existingUser) {
        return NextResponse.json({ error: "Аккаунт не найден. Сначала зарегистрируйтесь." }, { status: 404 });
      }

      try {
        await ensureUserWorkspace(admin, { user: existingUser });
      } catch (provisionError) {
        console.error("[auth.login.provisionExisting]", {
          message: provisionError instanceof Error ? provisionError.message : "Unknown provisioning error"
        });
      }

      return NextResponse.json({ error: "Неверный пароль. Проверьте данные и попробуйте снова." }, { status: 401 });
    }

    const admin = createAdminClient();
    let workspace: { businessId: string };
    try {
      workspace = await ensureUserWorkspace(admin, { user: data.user });
    } catch (provisionError) {
      console.error("[auth.login.provision]", {
        message: provisionError instanceof Error ? provisionError.message : "Unknown provisioning error"
      });
      return NextResponse.json({ error: "Не удалось подготовить рабочее пространство." }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        userId: data.user.id,
        nextPath: workspace.businessId ? "/dashboard" : "/onboarding",
        hasProfile: true,
        hasBusiness: Boolean(workspace.businessId)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
