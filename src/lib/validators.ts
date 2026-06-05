import { z } from "zod";

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email("Email is invalid").optional()
);

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
);

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Client name is required"),
  phone: z
    .string()
    .trim()
    .min(6, "Client phone is required")
    .regex(/^[+()0-9\s-]{6,24}$/, "Phone is invalid"),
  email: optionalEmail,
  notes: optionalText,
  telegram: optionalText
});

export const clientUpdateSchema = clientSchema.partial().extend({
  id: z.string().min(1)
});

export const clientDeleteSchema = z.object({
  id: z.string().min(1)
});

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  category: z.string().trim().min(1, "Service category is required"),
  description: z.string().max(1000).optional(),
  price: z.number().positive("Service price must be greater than 0"),
  duration_minutes: z.number().int().positive("Service duration must be greater than 0"),
  active: z.boolean().default(true)
});

export const serviceUpdateSchema = serviceSchema.partial().extend({
  id: z.string().min(1)
});

export const serviceDeleteSchema = z.object({
  id: z.string().min(1)
});

export const appointmentSchema = z.object({
  client_id: z.string().trim().min(1, "Client is required"),
  service_id: z.string().trim().min(1, "Service is required"),
  starts_at: z.string().datetime("Appointment date and time are required"),
  ends_at: z.string().datetime("Appointment end time is required"),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  notes: z.string().optional()
});

export const appointmentUpdateSchema = appointmentSchema.partial().extend({
  id: z.string().min(1)
});

export const appointmentStatusActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["complete", "cancel", "no_show"])
});

export const appointmentDeleteSchema = z.object({
  id: z.string().min(1)
});

export const financeOperationSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.string().trim().min(1, "Category is required"),
  description: z.string().trim().optional(),
  occurred_at: z.string().datetime("Operation date is required")
});

export const financeOperationUpdateSchema = financeOperationSchema.partial().extend({
  id: z.string().min(1),
  type: z.enum(["income", "expense"])
});

export const financeOperationDeleteSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["income", "expense"])
});

export const telegramSettingsSchema = z.object({
  bot_token: z.string().trim().min(1, "Bot Token is required"),
  chat_id: z.string().trim().min(1, "Chat ID is required"),
  enabled: z.boolean(),
  reminder_24h: z.boolean(),
  reminder_2h: z.boolean()
});

export const telegramActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    settings: telegramSettingsSchema
  }),
  z.object({
    action: z.literal("test_token"),
    bot_token: z.string().trim().min(1, "Bot Token is required")
  }),
  z.object({
    action: z.literal("send_test"),
    bot_token: z.string().trim().min(1, "Bot Token is required"),
    chat_id: z.string().trim().min(1, "Chat ID is required")
  })
]);
