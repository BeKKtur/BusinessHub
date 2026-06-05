export type SubscriptionPlan = "free" | "pro" | "business";

export type PlanLimit = number | "unlimited";

export const planDetails: Record<
  SubscriptionPlan,
  {
    label: string;
    clients: string;
    appointments: string;
    clientLimit: PlanLimit;
    appointmentLimit: PlanLimit;
    features: string[];
  }
> = {
  free: {
    label: "Free",
    clients: "50 клиентов",
    appointments: "100 записей",
    clientLimit: 50,
    appointmentLimit: 100,
    features: ["До 50 клиентов", "До 100 записей", "Базовый dashboard"]
  },
  pro: {
    label: "Pro",
    clients: "Безлимитные клиенты",
    appointments: "Безлимитные записи",
    clientLimit: "unlimited",
    appointmentLimit: "unlimited",
    features: ["Безлимитные клиенты", "Безлимитные записи", "Финансовая аналитика"]
  },
  business: {
    label: "Business",
    clients: "Безлимитные клиенты",
    appointments: "Безлимитные записи",
    clientLimit: "unlimited",
    appointmentLimit: "unlimited",
    features: ["Все из Pro", "Telegram automation", "Расширенная аналитика"]
  }
};

export function formatLimit(limit: PlanLimit) {
  return limit === "unlimited" ? "Безлимитно" : String(limit);
}
