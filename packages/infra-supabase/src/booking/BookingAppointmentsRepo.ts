// packages/infra-supabase/src/booking/BookingAppointmentsRepo.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingAppointmentsRepository,
  AppointmentStatus,
} from "@vicaper/domain";

export class BookingAppointmentsRepo implements BookingAppointmentsRepository {
  constructor(private readonly admin: SupabaseClient) {}

  async listByTerrenoAndRange(input: {
    terrenoId: string;
    startsAt: Date;
    endsAt: Date;
    status?: AppointmentStatus;
  }): Promise<
    Array<{ startsAt: Date; endsAt: Date; status: AppointmentStatus }>
  > {
    let q = this.admin
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("terreno_id", input.terrenoId)
      .gte("starts_at", input.startsAt.toISOString())
      .lt("starts_at", input.endsAt.toISOString());

    if (input.status) q = q.eq("status", input.status);

    const { data, error } = await q;

    if (error) throw new Error(error.message);

    return (data ?? []).map((r: any) => ({
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
      status: r.status as AppointmentStatus,
    }));
  }

  async createScheduledWithVisitor(input: {
    terrenoId: string;
    assignedUserId: string;
    startsAt: Date;
    endsAt: Date;
    visitorName: string;
    visitorEmail: string;
    visitorPhone: string;
    notes?: string;
  }): Promise<{ id: string }> {
    const payload: Record<string, any> = {
      terreno_id: input.terrenoId,
      assigned_user_id: input.assignedUserId,
      status: "scheduled",
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
      visitor_name: input.visitorName,
      visitor_email: input.visitorEmail,
      visitor_phone: input.visitorPhone,
    };

    // exactOptionalPropertyTypes friendly
    if (input.notes) payload.notes = input.notes;

    const { data, error } = await this.admin
      .from("appointments")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return { id: String(data.id) };
  }
}
