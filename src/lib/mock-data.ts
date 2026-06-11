import type { Appointment, Client, Service } from "@/types/database";

export const businessId = "00000000-0000-4000-9000-000000000001";

export const clients: Client[] = [
  {
    id: "client-1",
    business_id: businessId,
    name: "Алина Морозова",
    phone: "+996 700 123 456",
    email: "alina@example.com",
    notes: "Предпочитает утренние записи",
    telegram: "@alina_m",
    visits_count: 8,
    served_counted_at: null,
    created_at: "2026-06-01T09:00:00Z"
  },
  {
    id: "client-2",
    business_id: businessId,
    name: "Тимур Садыков",
    phone: "+996 555 777 222",
    email: "timur@example.com",
    notes: "VIP клиент",
    telegram: "@timur_s",
    visits_count: 14,
    served_counted_at: null,
    created_at: "2026-05-22T09:00:00Z"
  },
  {
    id: "client-3",
    business_id: businessId,
    name: "Елена Ким",
    phone: "+996 777 333 111",
    email: null,
    notes: "Напоминать через Telegram",
    telegram: "777333111",
    visits_count: 3,
    served_counted_at: null,
    created_at: "2026-05-29T09:00:00Z"
  }
];

export const services: Service[] = [
  {
    id: "service-1",
    business_id: businessId,
    name: "Стрижка и укладка",
    category: "Основные",
    description: "Базовая услуга для регулярных клиентов",
    price: 25,
    duration_minutes: 60,
    active: true,
    created_at: "2026-05-20T09:00:00Z"
  },
  {
    id: "service-2",
    business_id: businessId,
    name: "Окрашивание",
    category: "Премиум",
    description: "Премиальная услуга с консультацией мастера",
    price: 80,
    duration_minutes: 150,
    active: true,
    created_at: "2026-05-20T09:00:00Z"
  },
  {
    id: "service-3",
    business_id: businessId,
    name: "Консультация",
    category: "Вводные",
    description: "Короткая консультация перед основной услугой",
    price: 10,
    duration_minutes: 20,
    active: false,
    created_at: "2026-05-20T09:00:00Z"
  }
];

export const appointments: Appointment[] = [
  {
    id: "appointment-1",
    business_id: businessId,
    client_id: "client-1",
    service_id: "service-1",
    starts_at: "2026-06-04T09:00:00Z",
    ends_at: "2026-06-04T10:00:00Z",
    status: "scheduled",
    notes: null,
    usage_counted_at: null,
    created_at: "2026-06-01T09:00:00Z"
  },
  {
    id: "appointment-2",
    business_id: businessId,
    client_id: "client-2",
    service_id: "service-2",
    starts_at: "2026-06-04T11:30:00Z",
    ends_at: "2026-06-04T14:00:00Z",
    status: "scheduled",
    notes: "Подтверждено",
    usage_counted_at: null,
    created_at: "2026-06-01T09:00:00Z"
  },
  {
    id: "appointment-3",
    business_id: businessId,
    client_id: "client-3",
    service_id: "service-1",
    starts_at: "2026-06-05T08:00:00Z",
    ends_at: "2026-06-05T09:00:00Z",
    status: "no_show",
    notes: "Перенесено с четверга",
    usage_counted_at: null,
    created_at: "2026-06-02T09:00:00Z"
  }
];

export const revenueSeries = [
  { month: "Янв", revenue: 1800, profit: 1220 },
  { month: "Фев", revenue: 2300, profit: 1580 },
  { month: "Мар", revenue: 2100, profit: 1410 },
  { month: "Апр", revenue: 3100, profit: 2200 },
  { month: "Май", revenue: 3700, profit: 2680 },
  { month: "Июн", revenue: 1260, profit: 820 }
];

export const activity = [
  "Алина Морозова записана на сегодня 09:00",
  "Получена оплата $80 за окрашивание",
  "Telegram напоминание отправлено Тимуру",
  "Создан новый клиент Елена Ким"
];
