import { z } from "zod";
import { IsoDateTimeString, UuidString } from "../shared/iso";

export const AppointmentStatus = z.enum([
  "scheduled",
  "completed",
  "no_show",
  "cancelled",
]);
const BrandingSchema = {
  primaryColor: z.string().default("#2563eb"),
  backgroundColor: z.string().default("#ffffff"),
  logoUrl: z.string().optional().or(z.literal("")),
};

export const BookingSettingsGetResponse = z.object({
  terrenoId: UuidString,
  slug: z.string(),
  bookingEnabled: z.boolean(),
  timezone: z.string(),
  slotDurationMinutes: z.number(),
  bufferMinutes: z.number(),
  workingHours: z.any(), // Podrías tiparlo más estrictamente si lo deseas
  ...BrandingSchema, // Inyectamos los campos de branding
});

export const BookingSettingsUpdateRequest = z.object({
  slug: z.string(),
  bookingEnabled: z.boolean(),
  slotDurationMinutes: z.number(),
  bufferMinutes: z.number(),
  workingHours: z.any(),
  ...BrandingSchema, // Inyectamos los campos de branding
});

export const AppointmentDto = z.object({
  id: UuidString,
  terrenoId: UuidString,
  assignedUserId: UuidString,
  leadId: UuidString.optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  status: AppointmentStatus,
  startsAt: IsoDateTimeString,
  endsAt: IsoDateTimeString,
  createdAt: IsoDateTimeString,
  updatedAt: IsoDateTimeString,
});

export const CreateAppointmentRequest = z.object({
  assignedUserId: UuidString,
  startsAt: IsoDateTimeString,
  endsAt: IsoDateTimeString.optional(),
  leadId: UuidString.optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateAppointmentResponse = z.object({
  appointment: AppointmentDto,
});

export const AvailabilityQuery = z.object({
  assignedUserId: UuidString,
  from: IsoDateTimeString,
  to: IsoDateTimeString,
});

export const AvailabilityResponse = z.object({
  appointments: z.array(AppointmentDto),
});

export const MarkAttendanceRequest = z.object({
  status: z.enum(["completed", "no_show"]),
});

export const MarkAttendanceResponse = z.object({
  appointment: AppointmentDto,
});
