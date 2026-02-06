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
export type AppointmentCreatedEvent = DomainEvent<"AppointmentCreated", AppointmentCreatedPayload>;
export type AppointmentAttendanceMarkedEvent = DomainEvent<"AppointmentAttendanceMarked", AppointmentAttendanceMarkedPayload>;
export declare function toAppointmentCreatedEvent(args: {
    eventId: string;
    terrenoId: string;
    occurredAt: Date;
    appointment: Appointment;
}): AppointmentCreatedEvent;
export declare function toAppointmentAttendanceMarkedEvent(args: {
    eventId: string;
    terrenoId: string;
    occurredAt: Date;
    appointment: Appointment;
}): AppointmentAttendanceMarkedEvent;
//# sourceMappingURL=events.d.ts.map