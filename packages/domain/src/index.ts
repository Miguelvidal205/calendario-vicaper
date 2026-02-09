// packages/domain/src/index.ts

export const DOMAIN_VERSION = "0.0.0";

// ---- Errors
export type { AppErrorCode } from "./errors/appError";
export { AppError } from "./errors/appError";
export {
  validationError,
  conflictOverlapError,
  notFoundError,
  infraError,
} from "./errors/appError";

// ---- Ports
export type { AppointmentRepository } from "./ports/appointmentRepository";
export type { EventBus, DomainEvent } from "./ports/eventBus";

// ---- Scheduling
export type { Appointment, AppointmentStatus } from "./scheduling/types";
export { AppointmentService } from "./scheduling/appointmentService";
export {
  toAppointmentCreatedEvent,
  toAppointmentAttendanceMarkedEvent,
} from "./scheduling/events";

// ---- Booking (✅ VALOR + TYPES)
export { BookingService } from "./booking/BookingService";
export type {
  BookingAssigneeResolver,
  BookingSettings,
  BookingSettingsRepository,
  BookingAppointmentsRepository,
  BookingServiceDeps,
} from "./booking/BookingService";
