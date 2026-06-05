import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { telegramActionSchema } from "@/lib/validators";
import type { Database, Json } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

type TelegramSettings = {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  reminder_24h: boolean;
  reminder_2h: boolean;
  connected: boolean;
  last_test_sent_at: string | null;
};

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        single: () => Promise<QueryResult<{ id: string }>>;
      };
    };
  };
};

type NotificationsTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      eq: (column: "channel", value: "telegram") => {
        eq: (column: "type", value: "telegram_settings") => {
          limit: (count: number) => Promise<QueryResult<Notification[]>>;
        };
      };
    };
  };
  insert: (payload: NotificationInsert) => {
    select: (columns: string) => {
      single: () => Promise<QueryResult<Notification>>;
    };
  };
  update: (payload: NotificationUpdate) => {
    eq: (column: "id", value: string) => {
      eq: (column: "business_id", value: string) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<Notification>>;
        };
      };
    };
  };
};

function businessesTable(supabase: SupabaseServerClient) {
  return supabase.from("businesses") as unknown as BusinessesTable;
}

function notificationsTable(supabase: SupabaseServerClient) {
  return supabase.from("notifications") as unknown as NotificationsTable;
}

async function getSupabaseContext() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
    return { error: supabaseConfigErrorResponse() };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: business, error: businessError } = await businessesTable(supabase)
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();

  if (businessError || !business) {
    return { error: NextResponse.json({ error: "Business workspace not found" }, { status: 404 }) };
  }

  return { supabase, businessId: business.id };
}

function defaultSettings(): TelegramSettings {
  return {
    bot_token: "",
    chat_id: "",
    enabled: false,
    reminder_24h: true,
    reminder_2h: true,
    connected: false,
    last_test_sent_at: null
  };
}

function normalizeSettings(notification?: Notification | null): TelegramSettings {
  const payload = (notification?.payload ?? {}) as Partial<TelegramSettings>;
  return {
    ...defaultSettings(),
    ...payload,
    connected: notification?.status === "connected" || Boolean(payload.connected)
  };
}

async function getSettings(context: { supabase: SupabaseServerClient; businessId: string }) {
  const { data, error } = await notificationsTable(context.supabase)
    .select("*")
    .eq("business_id", context.businessId)
    .eq("channel", "telegram")
    .eq("type", "telegram_settings")
    .limit(1);

  if (error) {
    console.error("[telegram.settings.get]", { message: error.message });
    return { error: NextResponse.json({ error: "Failed to load Telegram settings" }, { status: 500 }) };
  }

  return { notification: data?.[0] ?? null, settings: normalizeSettings(data?.[0] ?? null) };
}

async function saveSettings(
  context: { supabase: SupabaseServerClient; businessId: string },
  settings: TelegramSettings,
  notification?: Notification | null
) {
  const payload = settings as unknown as Json;

  if (notification) {
    const { data, error } = await notificationsTable(context.supabase)
      .update({
        status: settings.connected ? "connected" : "disconnected",
        payload
      })
      .eq("id", notification.id)
      .eq("business_id", context.businessId)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[telegram.settings.update]", { message: error?.message ?? "No row returned" });
      return { error: NextResponse.json({ error: "Failed to save Telegram settings" }, { status: 500 }) };
    }

    return { notification: data, settings: normalizeSettings(data) };
  }

  const { data, error } = await notificationsTable(context.supabase)
    .insert({
      business_id: context.businessId,
      channel: "telegram",
      type: "telegram_settings",
      status: settings.connected ? "connected" : "disconnected",
      payload
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[telegram.settings.insert]", { message: error?.message ?? "No row returned" });
    return { error: NextResponse.json({ error: "Failed to save Telegram settings" }, { status: 500 }) };
  }

  return { notification: data, settings: normalizeSettings(data) };
}

async function callTelegram<T>(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string; result?: T } | null;

    if (!response.ok || !payload?.ok) {
      return { error: payload?.description ?? "Telegram API request failed" };
    }

    return { result: payload.result };
  } catch (error) {
    return { error: error instanceof Error && error.name === "AbortError" ? "Telegram API request timed out" : "Telegram API request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const context = await getSupabaseContext();
  if (context.error) return context.error;

  const result = await getSettings(context);
  if (result.error) return result.error;

  return NextResponse.json({ data: result.settings, meta: { source: "supabase" } });
}

export async function POST(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, telegramActionSchema);

    if (payload.action === "test_token") {
      const telegram = await callTelegram<{ username?: string; first_name?: string }>(
        `https://api.telegram.org/bot${payload.bot_token}/getMe`
      );

      if (telegram.error) {
        return NextResponse.json({ error: telegram.error }, { status: 502 });
      }

      return NextResponse.json({ data: telegram.result });
    }

    if (payload.action === "send_test") {
      const telegram = await callTelegram(`https://api.telegram.org/bot${payload.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: payload.chat_id,
          text: "BusinessHub test notification"
        })
      });

      if (telegram.error) {
        return NextResponse.json({ error: telegram.error }, { status: 502 });
      }

      const current = await getSettings(context);
      if (current.error) return current.error;
      const settings = {
        ...current.settings,
        bot_token: payload.bot_token,
        chat_id: payload.chat_id,
        connected: true,
        last_test_sent_at: new Date().toISOString()
      };
      const saved = await saveSettings(context, settings, current.notification);
      if (saved.error) return saved.error;

      return NextResponse.json({ data: saved.settings });
    }

    const current = await getSettings(context);
    if (current.error) return current.error;
    const saved = await saveSettings(
      context,
      {
        ...payload.settings,
        connected: true,
        last_test_sent_at: current.settings.last_test_sent_at
      },
      current.notification
    );
    if (saved.error) return saved.error;

    return NextResponse.json({ data: saved.settings });
  } catch (error) {
    return apiError(error);
  }
}
