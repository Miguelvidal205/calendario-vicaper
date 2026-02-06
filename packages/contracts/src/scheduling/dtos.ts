import { z } from "zod";
import { IsoDateTimeString, UuidString } from "../shared/iso";

export const AppointmentStatus = z.enum([
  "scheduled",
  "completed",
  "no_show",
  "cancelled",
]);

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
