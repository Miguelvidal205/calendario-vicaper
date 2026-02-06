import type { AppointmentRepository } from "../ports/appointmentRepository";
import type { EventBus } from "../ports/eventBus";
import type { Appointment, AppointmentStatus } from "./types";
export interface AppointmentServiceDeps {
    repo: AppointmentRepository;
    events: EventBus;
    newId: () => string;
}
export declare class AppointmentService {
    private readonly repo;
    private readonly events;
    private readonly newId;
    constructor(deps: AppointmentServiceDeps);
    create(input: {
        terrenoId: string;
        assignedUserId: string;
        startsAt: Date;
        endsAt?: Date;
        leadId?: string;
        title?: string;
        notes?: string;
    }): Promise<Appointment>;
    availability(input: {
        terrenoId: string;
        assignedUserId: string;
        from: Date;
        to: Date;
    }): Promise<Appointment[]>;
    markAttendance(input: {
        terrenoId: string;
        appointmentId: string;
        status: Extract<AppointmentStatus, "completed" | "no_show">;
    }): Promise<Appointment>;
}
//# sourceMappingURL=appointmentService.d.ts.map