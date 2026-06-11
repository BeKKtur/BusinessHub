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
    clients: "50 обслуженных клиентов",
    appointments: "50 завершённых записей",
    clientLimit: 50,
    appointmentLimit: 50,
    features: ["50 обслуженных клиентов", "50 завершённых записей", "Базовый dashboard"]
  },
  pro: {
    label: "Pro",
    clients: "500 обслуженных клиентов",
    appointments: "500 завершённых записей",
    clientLimit: 500,
    appointmentLimit: 500,
    features: ["500 обслуженных клиентов", "500 завершённых записей", "Финансовая аналитика"]
  },
  business: {
    label: "Business",
    clients: "Безлимитные обслуженные клиенты",
    appointments: "Безлимитные завершённые записи",
    clientLimit: "unlimited",
    appointmentLimit: "unlimited",
    features: ["Безлимитные обслуженные клиенты", "Безлимитные завершённые записи", "Telegram-автоматизация", "Продвинутая аналитика"]
  }
};

export function formatLimit(limit: PlanLimit) {
  return limit === "unlimited" ? "Безлимитно" : String(limit);
}
