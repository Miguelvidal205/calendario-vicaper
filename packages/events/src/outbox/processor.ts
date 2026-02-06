import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@vicaper/observability";

type OutboxRow = {
  id: string;
  terreno_id: string;
  event_type: string;
  payload: unknown;
  status: "pending" | "processing" | "delivered" | "failed" | "dead";
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
};

export class OutboxProcessor {
  private readonly client: SupabaseClient;
  private readonly logger: Logger;
  private readonly handlers: Array<(evt: any) => Promise<void>>;

  constructor(args: {
    client: SupabaseClient;
    logger: Logger;
    handlers: Array<(evt: any) => Promise<void>>;
  }) {
    this.client = args.client;
    this.logger = args.logger;
    this.handlers = args.handlers;
  }

  private async claim(
    maxEvents: number,
    lockedBy: string,
  ): Promise<OutboxRow[]> {
    const { data, error } = await this.client.rpc("rpc_claim_outbox_events", {
      p_max_events: maxEvents,
      p_locked_by: lockedBy,
    });

    if (error) {
      this.logger.error("outbox.claim rpc failed", {
        message: error.message,
        code: (error as any).code,
      });
      throw new Error(error.message);
    }

    return (data ?? []) as OutboxRow[];
  }

  async processBatch(args: { maxEvents: number; lockedBy: string }) {
    const claimed = await this.claim(args.maxEvents, args.lockedBy);
    let delivered = 0;
    let failed = 0;

    for (const row of claimed) {
      try {
        // tu lógica actual: ejecutar handlers con idempotencia event_deliveries + update outbox
        await this.processOne(row);
        delivered += 1;
      } catch (e) {
        failed += 1;
        // tu lógica actual de retry/backoff
        await this.markFailed(row, e);
      }
    }

    return { claimed: claimed.length, delivered, failed };
  }

  // 👇 Mantén tu implementación existente (solo asegúrate que existan)
  private async processOne(row: OutboxRow): Promise<void> {
    // usa tu lógica actual (handlers + event_deliveries unique)
    for (const h of this.handlers) {
      await h(row);
    }

    const { error } = await this.client
      .from("event_outbox")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (error) throw new Error(error.message);
  }

  private computeNextRetry(attempts: number): string {
    const mins = [1, 2, 5, 10, 30, 60];
    const m = mins[Math.min(attempts, mins.length - 1)];
    const d = new Date();
    d.setMinutes(d.getMinutes() + m);
    return d.toISOString();
  }

  private async markFailed(row: OutboxRow, err: unknown): Promise<void> {
    const attempts = (row.attempts ?? 0) + 1;
    const nextRetryAt = this.computeNextRetry(attempts);
    const msg = err instanceof Error ? err.message : "Unknown error";

    const { error } = await this.client
      .from("event_outbox")
      .update({
        status: "pending",
        attempts,
        next_retry_at: nextRetryAt,
        last_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error)
      this.logger.error("outbox.markFailed failed", { message: error.message });
  }
}
