import type { Appointment } from "@vicaper/domain";
import type { AppointmentRow } from "../shared/supabaseTypes";

export function mapAppointmentRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    terrenoId: row.terreno_id,
    assignedUserId: row.assigned_user_id,
    ...(row.lead_id ? { leadId: row.lead_id } : {}),
    ...(row.title ? { title: row.title } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    status: row.status,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
