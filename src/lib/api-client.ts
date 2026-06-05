type ApiErrorPayload = {
  error?: string;
  missingEnv?: string[];
  placeholderEnv?: string[];
  invalidEnv?: string[];
  setup?: string;
};

export function formatApiError(payload: ApiErrorPayload | null, fallback: string) {
  if (!payload?.error) return fallback;
  if (payload.error === "Unauthorized") return "Сессия истекла. Войдите снова.";

  const envProblems = [
    ...(payload.missingEnv?.map((key) => `missing ${key}`) ?? []),
    ...(payload.placeholderEnv?.map((key) => `placeholder ${key}`) ?? []),
    ...(payload.invalidEnv?.map((key) => `invalid ${key}`) ?? [])
  ];

  if (!envProblems.length) return payload.error;

  return `${payload.error}: ${envProblems.join(", ")}. ${payload.setup ?? ""}`.trim();
}
