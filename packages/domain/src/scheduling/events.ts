import { DomainEvent } from "../ports/eventBus";
import type { Appointment, AppointmentStatus } from "./types";

export type AppointmentCreatedPayload = {
  appointment: {
    id: string;
    assignedUserId: string;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
  };
};

export type AppointmentAttendanceMarkedPayload = {
  appointment: {
    id: string;
    assignedUserId: string;
    status: AppointmentStatus;
  };
};

export type AppointmentCreatedEvent = DomainEvent<
  "AppointmentCreated",
  AppointmentCreatedPayload
>;
export type AppointmentAttendanceMarkedEvent = DomainEvent<
  "AppointmentAttendanceMarked",
  AppointmentAttendanceMarkedPayload
>;

export function toAppointmentCreatedEvent(args: {
  eventId: string;
  terrenoId: string;
  occurredAt: Date;
  appointment: Appointment;
}): AppointmentCreatedEvent {
  return {
    id: args.eventId,
    type: "AppointmentCreated",
    terrenoId: args.terrenoId,
    occurredAt: args.occurredAt,
    payload: {
      appointment: {
        id: args.appointment.id,
        assignedUserId: args.appointment.assignedUserId,
        startsAt: args.appointment.startsAt.toISOString(),
        endsAt: args.appointment.endsAt.toISOString(),
        status: args.appointment.status,
      },
    },
  };
}

export function toAppointmentAttendanceMarkedEvent(args: {
  eventId: string;
  terrenoId: string;
  occurredAt: Date;
  appointment: Appointment;
}): AppointmentAttendanceMarkedEvent {
  return {
    id: args.eventId,
    type: "AppointmentAttendanceMarked",
    terrenoId: args.terrenoId,
    occurredAt: args.occurredAt,
    payload: {
      appointment: {
        id: args.appointment.id,
        assignedUserId: args.appointment.assignedUserId,
        status: args.appointment.status,
      },
    },
  };
}
