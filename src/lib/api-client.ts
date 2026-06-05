type ApiErrorPayload = {
  error?: string;
  missingEnv?: string[];
  placeholderEnv?: string[];
  setup?: string;
};

export function formatApiError(payload: ApiErrorPayload | null, fallback: string) {
  if (!payload?.error) return fallback;

  const envProblems = [
    ...(payload.missingEnv?.map((key) => `missing ${key}`) ?? []),
    ...(payload.placeholderEnv?.map((key) => `placeholder ${key}`) ?? [])
  ];

  if (!envProblems.length) return payload.error;

  return `${payload.error}: ${envProblems.join(", ")}. ${payload.setup ?? ""}`.trim();
}
