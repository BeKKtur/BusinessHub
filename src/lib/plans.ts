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
    appointments: "50 записей",
    clientLimit: 50,
    appointmentLimit: 50,
    features: ["До 50 клиентов", "До 50 записей", "Базовый dashboard"]
  },
  pro: {
    label: "Pro",
    clients: "500 клиентов",
    appointments: "500 записей",
    clientLimit: 500,
    appointmentLimit: 500,
    features: ["До 500 клиентов", "До 500 записей", "Финансовая аналитика"]
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
