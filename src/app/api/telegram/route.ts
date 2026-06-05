import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseJson, requireAuth } from "@/lib/api";

const telegramSchema = z.object({
  chat_id: z.string().min(1).max(128),
  text: z.string().min(1).max(4096)
});

export async function POST(request: Request) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const payload = await parseJson(request, telegramSchema);
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: "Telegram API request failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
