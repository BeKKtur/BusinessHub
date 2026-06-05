import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const maxJsonBytes = 64 * 1024;
const requiredSupabaseEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function parseJson<T extends z.ZodTypeAny>(request: Request, schema: T) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxJsonBytes) {
    throw new HttpError(413, "Payload too large");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Malformed JSON payload");
  }

  return schema.parse(body) as z.infer<T>;
}

export async function requireAuth() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length) {
    return supabaseConfigErrorResponse();
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function getMissingSupabaseEnv() {
  return requiredSupabaseEnv.filter((key) => !process.env[key]);
}

export function getSupabaseEnvStatus() {
  const missingEnv = getMissingSupabaseEnv();
  const placeholderEnv = requiredSupabaseEnv.filter((key) => {
    const value = process.env[key];
    if (!value) return false;
    return value.includes("your-project") || value.startsWith("your-") || value.includes("replace-with");
  });

  return { missingEnv, placeholderEnv };
}

export function supabaseConfigErrorResponse() {
  const { missingEnv, placeholderEnv } = getSupabaseEnvStatus();

  return NextResponse.json(
    {
      error: "Supabase is not configured",
      missingEnv,
      placeholderEnv,
      setup:
        "Add the missing values to .env.local. You can find them in Supabase Dashboard -> Project Settings -> API."
    },
    { status: 503 }
  );
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 422 });
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
