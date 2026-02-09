// packages/infra-supabase/src/booking/BookingSettingsRepo.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingSettings,
  BookingSettingsRepository,
} from "@vicaper/domain";

export class BookingSettingsRepo implements BookingSettingsRepository {
  constructor(private readonly admin: SupabaseClient) {}

  async getByTerrenoId(terrenoId: string): Promise<BookingSettings | null> {
    const { data, error } = await this.admin
      .from("booking_settings")
      .select(
        "terreno_id, timezone, day_start, day_end, slot_duration_minutes, min_notice_minutes, max_days_ahead",
      )
      .eq("terreno_id", terrenoId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      terrenoId: String(data.terreno_id),
      timezone: String(data.timezone ?? "America/Argentina/Buenos_Aires"),
      dayStart: String(data.day_start ?? "09:00"),
      dayEnd: String(data.day_end ?? "18:00"),
      slotDurationMinutes: Number(data.slot_duration_minutes ?? 60),
      ...(data.min_notice_minutes != null
        ? { minNoticeMinutes: Number(data.min_notice_minutes) }
        : {}),
      ...(data.max_days_ahead != null
        ? { maxDaysAhead: Number(data.max_days_ahead) }
        : {}),
    };
  }
}
