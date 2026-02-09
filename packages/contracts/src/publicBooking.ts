import { z } from "zod";

export const PublicBookingAvailabilityQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

export const PublicBookingSlotDto = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
});

export const PublicBookingAvailabilityResponse = z.object({
  terrenoId: z.string().uuid(),
  timezone: z.string(),
  date: z.string(),
  slotDurationMinutes: z.number().int().positive(),
  slots: z.array(PublicBookingSlotDto),
});
export type PublicBookingAvailabilityResponse = z.infer<
  typeof PublicBookingAvailabilityResponse
>;

export const PublicBookingCreateRequest = z.object({
  startsAt: z.string(),
  visitorName: z.string().min(2).max(120),
  visitorEmail: z.string().email().max(200),
  visitorPhone: z.string().min(5).max(30),
  notes: z.string().max(2000).optional(),
  bookingKey: z.string().min(12).max(200),
});

export const PublicBookingCreateResponse = z.object({
  appointmentId: z.string().uuid(),
});
export type PublicBookingCreateResponse = z.infer<
  typeof PublicBookingCreateResponse
>;
