import { validationError } from "../errors/appError";
import { toAppointmentAttendanceMarkedEvent, toAppointmentCreatedEvent, } from "./events";
export class AppointmentService {
    repo;
    events;
    newId;
    constructor(deps) {
        this.repo = deps.repo;
        this.events = deps.events;
        this.newId = deps.newId;
    }
    async create(input) {
        const startsAt = input.startsAt;
        const endsAt = input.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
        if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
            throw validationError("startsAt is invalid");
        }
        if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
            throw validationError("endsAt is invalid");
        }
        if (endsAt.getTime() <= startsAt.getTime()) {
            throw validationError("endsAt must be after startsAt");
        }
        try {
            const created = await this.repo.create({
                terrenoId: input.terrenoId,
                assignedUserId: input.assignedUserId,
                startsAt,
                endsAt,
                ...(input.leadId ? { leadId: input.leadId } : {}),
                ...(input.title ? { title: input.title } : {}),
                ...(input.notes ? { notes: input.notes } : {}),
            });
            const occurredAt = new Date();
            await this.events.publish(toAppointmentCreatedEvent({
                eventId: this.newId(),
                terrenoId: input.terrenoId,
                occurredAt,
                appointment: created,
            }));
            return created;
        }
        catch (err) {
            // Infra mapeará overlap idealmente; pero si alguien tiró un AppError, lo dejamos pasar.
            if (err instanceof Error && err.code === "CONFLICT_OVERLAP")
                throw err;
            throw err;
        }
    }
    async availability(input) {
        const from = input.from;
        const to = input.to;
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw validationError("from/to is invalid");
        }
        if (to.getTime() <= from.getTime()) {
            throw validationError("to must be after from");
        }
        return this.repo.listByRange({
            terrenoId: input.terrenoId,
            assignedUserId: input.assignedUserId,
            from,
            to,
        });
    }
    async markAttendance(input) {
        const updated = await this.repo.markStatus({
            terrenoId: input.terrenoId,
            appointmentId: input.appointmentId,
            status: input.status,
        });
        const occurredAt = new Date();
        await this.events.publish(toAppointmentAttendanceMarkedEvent({
            eventId: this.newId(),
            terrenoId: input.terrenoId,
            occurredAt,
            appointment: updated,
        }));
        return updated;
    }
}
