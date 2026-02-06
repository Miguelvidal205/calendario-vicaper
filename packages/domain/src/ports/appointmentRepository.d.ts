import type { Appointment, AppointmentStatus } from "../scheduling/types";
export interface AppointmentRepository {
    create(input: {
        terrenoId: string;
        assignedUserId: string;
        startsAt: Date;
        endsAt: Date;
        leadId?: string;
        title?: string;
        notes?: string;
    }): Promise<Appointment>;
    listByRange(input: {
        terrenoId: string;
        assignedUserId: string;
        from: Date;
        to: Date;
    }): Promise<Appointment[]>;
    markStatus(input: {
        terrenoId: string;
        appointmentId: string;
        status: AppointmentStatus;
    }): Promise<Appointment>;
}
//# sourceMappingURL=appointmentRepository.d.ts.map