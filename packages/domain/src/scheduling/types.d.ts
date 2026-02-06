export type AppointmentStatus = "scheduled" | "completed" | "no_show" | "cancelled";
export interface Appointment {
    id: string;
    terrenoId: string;
    assignedUserId: string;
    leadId?: string;
    title?: string;
    notes?: string;
    status: AppointmentStatus;
    startsAt: Date;
    endsAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=types.d.ts.map