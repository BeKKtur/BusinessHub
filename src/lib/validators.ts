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
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
  notes: z.string().optional()
});

export const appointmentUpdateSchema = appointmentSchema.partial().extend({
  id: z.string().min(1)
});

export const appointmentDeleteSchema = z.object({
  id: z.string().min(1)
});
