import { z } from "zod";

export const WeekdayKey = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);
export type WeekdayKey = z.infer<typeof WeekdayKey>;

export const WorkingHourRange = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
  end: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
});

export const WorkingHours = z.object({
  mon: z.array(WorkingHourRange).optional(),
  tue: z.array(WorkingHourRange).optional(),
  wed: z.array(WorkingHourRange).optional(),
  thu: z.array(WorkingHourRange).optional(),
  fri: z.array(WorkingHourRange).optional(),
  sat: z.array(WorkingHourRange).optional(),
  sun: z.array(WorkingHourRange).optional(),
});

export const BookingSettingsDto = z.object({
  terrenoId: z.string().uuid(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  bookingEnabled: z.boolean(),
  timezone: z.literal("America/Santiago"),
  slotDurationMinutes: z.number().int().min(15).max(240),
  bufferMinutes: z.number().int().min(0).max(60),
  workingHours: WorkingHours,
});
export type BookingSettingsDto = z.infer<typeof BookingSettingsDto>;

// ✅ estos dos deben existir con estos nombres
export const BookingSettingsGetResponse = BookingSettingsDto;

export const BookingSettingsUpdateRequest = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  bookingEnabled: z.boolean(),
  slotDurationMinutes: z.number().int().min(15).max(240),
  bufferMinutes: z.number().int().min(0).max(60),
  workingHours: WorkingHours,
});
export type BookingSettingsUpdateRequest = z.infer<
  typeof BookingSettingsUpdateRequest
>;
