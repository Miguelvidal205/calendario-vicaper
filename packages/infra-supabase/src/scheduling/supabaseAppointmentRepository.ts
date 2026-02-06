import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conflictOverlapError,
  infraError,
  notFoundError,
  type AppointmentRepository,
  type AppointmentStatus,
} from "@vicaper/domain";
import type { Logger } from "@vicaper/observability";
import type { AppointmentRow } from "../shared/supabaseTypes";
import { mapAppointmentRow } from "./mappers";

function isOverlapError(err: unknown): boolean {
  // Postgres exclusion_violation => SQLSTATE 23P01
  const e = err as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  if (!e) return false;
  if (e.code === "23P01") {
    const msg =
      `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
    return (
      msg.includes("no_overlapping_appointments") ||
      msg.includes("overlap") ||
      msg.includes("exclusion")
    );
  }
  return false;
}

export class SupabaseAppointmentRepository implements AppointmentRepository {
  private readonly client: SupabaseClient;
  private readonly logger: Logger;

  constructor(args: { client: SupabaseClient; logger: Logger }) {
    this.client = args.client;
    this.logger = args.logger;
  }

  async create(input: {
    terrenoId: string;
    assignedUserId: string;
    startsAt: Date;
    endsAt: Date;
    leadId?: string;
    title?: string;
    notes?: string;
  }) {
    const payload: Record<string, unknown> = {
      terreno_id: input.terrenoId,
      assigned_user_id: input.assignedUserId,
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
    };

    if (input.leadId) payload.lead_id = input.leadId;
    if (input.title) payload.title = input.title;
    if (input.notes) payload.notes = input.notes;

    const { data, error } = await this.client
      .from("appointments")
      .insert(payload)
      .select("*")
      .single<AppointmentRow>();

    if (error) {
      if (isOverlapError(error))
        throw conflictOverlapError({
          constraint: "no_overlapping_appointments",
        });
      this.logger.error("appointments.create failed", {
        code: (error as any).code,
        message: error.message,
      });
      throw infraError("Failed to create appointment", {
        supabase: { message: error.message, code: (error as any).code },
      });
    }

    return mapAppointmentRow(data);
  }

  async listByRange(input: {
    terrenoId: string;
    assignedUserId: string;
    from: Date;
    to: Date;
  }) {
    const { data, error } = await this.client
      .from("appointments")
      .select("*")
      .eq("terreno_id", input.terrenoId)
      .eq("assigned_user_id", input.assignedUserId)
      .gte("starts_at", input.from.toISOString())
      .lt("starts_at", input.to.toISOString())
      .order("starts_at", { ascending: true })
      .returns<AppointmentRow[]>();

    if (error) {
      this.logger.error("appointments.listByRange failed", {
        code: (error as any).code,
        message: error.message,
      });
      throw infraError("Failed to list appointments", {
        supabase: { message: error.message, code: (error as any).code },
      });
    }

    return (data ?? []).map(mapAppointmentRow);
  }

  async markStatus(input: {
    terrenoId: string;
    appointmentId: string;
    status: AppointmentStatus;
  }) {
    const { data, error } = await this.client
      .from("appointments")
      .update({ status: input.status })
      .eq("id", input.appointmentId)
      .eq("terreno_id", input.terrenoId)
      .select("*")
      .single<AppointmentRow>();

    if (error) {
      this.logger.error("appointments.markStatus failed", {
        code: (error as any).code,
        message: error.message,
      });
      throw infraError("Failed to update appointment", {
        supabase: { message: error.message, code: (error as any).code },
      });
    }
    if (!data) throw notFoundError("Appointment not found");

    return mapAppointmentRow(data);
  }
}
