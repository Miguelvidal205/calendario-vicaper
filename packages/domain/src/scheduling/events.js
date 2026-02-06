export function toAppointmentCreatedEvent(args) {
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
export function toAppointmentAttendanceMarkedEvent(args) {
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
