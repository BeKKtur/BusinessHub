import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import {
  createPaddleCheckoutTransaction,
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

function maskId(value?: string | null) {
  if (!value) return null;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function paddleErrorSummary(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown Paddle error" };
  }

  const record = error as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "PaddleError",
    message: typeof record.message === "string" ? record.message : "Unknown Paddle error",
    status: record.statusCode ?? record.status,
    code: record.code,
    type: record.type,
    detail: record.detail
  };
}

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

    const priceId = getPriceIdForPlan(payload.plan);
    if (!priceId) {
      return paddleConfigError([payload.plan === "pro" ? "PADDLE_PRO_PRICE_ID" : "PADDLE_BUSINESS_PRICE_ID"]);
    }

    const customData = {
      business_id: business.id,
      plan: payload.plan
    };

    let transaction: {
      id: string;
      status: string;
      checkout: { url: string | null } | null;
      customerId: string | null;
      subscriptionId: string | null;
    };

    try {
      transaction = await createPaddleCheckoutTransaction({
        priceId,
        quantity: 1,
        customData
      });
      console.info("[billing.checkout.paddle]", {
        plan: payload.plan,
        environment: getPaddleEnvironmentName(),
        priceId: maskId(priceId),
        transactionId: transaction.id,
        status: transaction.status,
        hasCheckoutUrl: Boolean(transaction.checkout?.url),
        customerId: maskId(transaction.customerId),
        subscriptionId: maskId(transaction.subscriptionId)
      });
    } catch (error) {
      console.error("[billing.checkout.paddle.error]", {
        plan: payload.plan,
        environment: getPaddleEnvironmentName(),
        priceId: maskId(priceId),
        error: paddleErrorSummary(error)
      });
      return NextResponse.json({ error: "Paddle checkout creation failed", details: paddleErrorSummary(error) }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        plan: payload.plan,
        priceId,
        transactionId: transaction.id,
        checkoutUrl: transaction.checkout?.url ?? null,
        clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
        environment: getPaddleEnvironmentName(),
        customerEmail: user.email ?? null,
        customData,
        checkoutMode: "paddle-js",
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/billing?checkout=success`
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
