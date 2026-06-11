import {
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  UserCircle,
  ReceiptText,
  Scissors,
  Settings,
  Users
} from "lucide-react";

export const businessTypes = [
  "Салон красоты",
  "Барбершоп",
  "Автомойка",
  "СТО",
  "Репетиторство",
  "Фитнес",
  "Другое"
] as const;

export const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Для старта и проверки процесса",
    features: ["50 обслуженных клиентов", "50 завершённых записей", "Базовый dashboard"]
  },
  {
    name: "Pro",
    price: "$10",
    description: "Для растущего сервиса",
    features: ["500 обслуженных клиентов", "500 завершённых записей", "Финансовая аналитика"]
  },
  {
    name: "Business",
    price: "$20",
    description: "Для системной автоматизации",
    features: ["Безлимитные обслуженные клиенты", "Безлимитные завершённые записи", "Telegram-автоматизация", "Продвинутая аналитика"]
  }
] as const;

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Профиль", icon: UserCircle },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/appointments", label: "Записи", icon: CalendarDays },
  { href: "/services", label: "Услуги", icon: Scissors },
  { href: "/finance", label: "Финансы", icon: ReceiptText },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/telegram", label: "Telegram", icon: Bot },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/admin", label: "Admin", icon: Settings }
] as const;
