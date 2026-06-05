import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerEnvStatus } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const maxJsonBytes = 64 * 1024;

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
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
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
  return getSupabaseServerEnvStatus().missingEnv;
}

export function getSupabaseEnvStatus() {
  return getSupabaseServerEnvStatus();
}

export function supabaseConfigErrorResponse() {
  const { invalidEnv, missingEnv, placeholderEnv } = getSupabaseEnvStatus();

  return NextResponse.json(
    {
      error: "Supabase is not configured",
      missingEnv,
      placeholderEnv,
      invalidEnv,
      setup:
        "Add valid values to .env.local. NEXT_PUBLIC_SUPABASE_URL must be the Supabase Project URL origin, for example https://your-project.supabase.co, without /rest/v1 or another path. You can find it in Supabase Dashboard -> Project Settings -> API."
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
