// packages/infra-supabase/src/booking/AssigneeResolver.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingAssigneeResolver } from "@vicaper/domain";

export class AssigneeResolver implements BookingAssigneeResolver {
  constructor(private readonly admin: SupabaseClient) {}

  async resolveAssignedUserId(terrenoId: string): Promise<string> {
    const { data, error } = await this.admin
      .from("terreno_booking_assignment")
      .select("mode, fixed_user_id")
      .eq("terreno_id", terrenoId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const mode = (data?.mode as string | null) ?? "fixed";
    const fixed = (data?.fixed_user_id as string | null) ?? null;

    if (mode === "fixed" && fixed) return fixed;

    // fallback: primer agente del terreno
    const { data: members, error: mErr } = await this.admin
      .from("terreno_users")
      .select("user_id, role")
      .eq("terreno_id", terrenoId)
      .eq("role", "agent")
      .order("created_at", { ascending: true })
      .limit(1);

    if (mErr) throw new Error(mErr.message);
    const first = members?.[0]?.user_id as string | undefined;
    if (!first) throw new Error("No agent available for booking");
    return first;
  }
}
