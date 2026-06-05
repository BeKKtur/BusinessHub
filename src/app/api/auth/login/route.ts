import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { isSupabasePublicConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    if (!isSupabasePublicConfigured()) {
      return supabaseConfigErrorResponse();
    }

    const payload = await parseJson(request, loginSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(payload);

    if (error || !data.user) {
      return NextResponse.json({ error: "Аккаунт не найден. Сначала зарегистрируйтесь." }, { status: 404 });
    }

    const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", data.user.id).limit(1).maybeSingle();

    return NextResponse.json({
      data: {
        userId: data.user.id,
        nextPath: profile && business ? "/dashboard" : "/onboarding",
        hasProfile: Boolean(profile),
        hasBusiness: Boolean(business)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
