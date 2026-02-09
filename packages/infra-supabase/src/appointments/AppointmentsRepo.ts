// packages/infra-supabase/src/appointments/AppointmentsRepo.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentRepository,
  Appointment,
  AppointmentStatus,
} from "@vicaper/domain";

type DbAppointmentRow = {
  id: string;
  terreno_id: string;
  assigned_user_id: string;
  lead_id: string | null;
  title: string | null;
  notes: string | null;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};

function mapRowToAppointment(r: DbAppointmentRow): Appointment {
  // ⚠️ exactOptionalPropertyTypes friendly:
  // No agregamos propiedades opcionales si son null
  const base: Appointment = {
    id: String(r.id),
    terrenoId: String(r.terreno_id),
    assignedUserId: String(r.assigned_user_id),
    status: r.status,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };

  return {
    ...base,
    ...(r.lead_id ? { leadId: String(r.lead_id) } : {}),
    ...(r.title ? { title: String(r.title) } : {}),
    ...(r.notes ? { notes: String(r.notes) } : {}),
  };
}

export class AppointmentsRepo implements AppointmentRepository {
  constructor(private readonly admin: SupabaseClient) {}

  async listByRange(input: {
    terrenoId: string;
    assignedUserId: string;
    from: Date;
    to: Date;
  }): Promise<Appointment[]> {
    const { data, error } = await this.admin
      .from("appointments")
      .select(
        "id, terreno_id, assigned_user_id, lead_id, title, notes, status, starts_at, ends_at, created_at, updated_at",
      )
      .eq("terreno_id", input.terrenoId)
      .eq("assigned_user_id", input.assignedUserId)
      .gte("starts_at", input.from.toISOString())
      .lt("starts_at", input.to.toISOString())
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((r: any) =>
      mapRowToAppointment(r as DbAppointmentRow),
    );
  }

  async create(input: {
    terrenoId: string;
    assignedUserId: string;
    startsAt: Date;
    endsAt: Date;
    leadId?: string;
    title?: string;
    notes?: string;
  }): Promise<Appointment> {
    const payload: Record<string, any> = {
      terreno_id: input.terrenoId,
      assigned_user_id: input.assignedUserId,
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
      status: "scheduled" satisfies AppointmentStatus,
    };

    // ✅ NO pasar undefined
    if (input.leadId) payload.lead_id = input.leadId;
    if (input.title) payload.title = input.title;
    if (input.notes) payload.notes = input.notes;

    const { data, error } = await this.admin
      .from("appointments")
      .insert(payload)
      .select(
        "id, terreno_id, assigned_user_id, lead_id, title, notes, status, starts_at, ends_at, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);

    return mapRowToAppointment(data as any);
  }

  async markStatus(input: {
    terrenoId: string;
    appointmentId: string;
    status: AppointmentStatus;
  }): Promise<Appointment> {
    const { data, error } = await this.admin
      .from("appointments")
      .update({ status: input.status })
      .eq("terreno_id", input.terrenoId)
      .eq("id", input.appointmentId)
      .select(
        "id, terreno_id, assigned_user_id, lead_id, title, notes, status, starts_at, ends_at, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);

    return mapRowToAppointment(data as any);
  }
}
