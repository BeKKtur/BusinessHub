import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import {
  getMissingPaddleEnv,
  getPaddleEnvironmentName,
  getPriceIdForPlan,
  isCheckoutPlan,
  paddleConfigError
} from "@/lib/server/billing";
import { createClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  plan: z.enum(["free", "pro", "business"])
});

type BillingBusiness = { id: string };

export async function POST(request: Request) {
  try {
    const envStatus = getSupabaseEnvStatus();
    if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
      return supabaseConfigErrorResponse();
    }

    const payload = await parseJson(request, checkoutSchema);
    if (!isCheckoutPlan(payload.plan)) {
      return NextResponse.json({ error: "Free plan does not require checkout" }, { status: 400 });
    }

    const missingEnv = getMissingPaddleEnv(payload.plan);
    if (missingEnv.length) {
      return paddleConfigError(missingEnv);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .single();
    const business = businessData as BillingBusiness | null;

    if (businessError || !business) {
      return NextResponse.json({ error: "Business workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        plan: payload.plan,
        priceId: getPriceIdForPlan(payload.plan),
        clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
        environment: getPaddleEnvironmentName(),
        customerEmail: user.email ?? null,
        customData: {
          business_id: business.id,
          plan: payload.plan
        },
        checkoutMode: "paddle-js",
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/billing?checkout=success`
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
