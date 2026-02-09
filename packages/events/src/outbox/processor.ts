import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@vicaper/observability";
import type { EventHandler, OutboxEventRow } from "../handlers/types";

type DeliveryInsertResult = { id: string } | null;

function backoffMinutes(attempts: number): number {
  // attempts = #intentos ya hechos antes de este ciclo
  // próxima espera: 1,2,5,10,30,60
  const schedule = [1, 2, 5, 10, 30, 60];
  return schedule[Math.min(attempts, schedule.length - 1)] ?? 60;
}

async function tryInsertDelivery(args: {
  client: SupabaseClient;
  eventId: string;
  handler: string;
  attempt: number;
}): Promise<boolean> {
  // Insert idempotente: unique(event_id, handler)
  const { error } = await args.client.from("event_deliveries").insert({
    event_id: args.eventId,
    handler: args.handler,
    status: "success",
    attempt: args.attempt,
  });

  if (!error) return true;

  // Postgres unique_violation -> 23505
  const code = (error as any).code as string | undefined;
  if (code === "23505") return false;

  throw error;
}

export class OutboxProcessor {
  private readonly client: SupabaseClient;
  private readonly logger: Logger;
  private readonly handlers: EventHandler[];

  constructor(args: {
    client: SupabaseClient;
    logger: Logger;
    handlers: EventHandler[];
  }) {
    this.client = args.client;
    this.logger = args.logger;
    this.handlers = args.handlers;
  }

  async processBatch(input: {
    maxEvents: number;
    lockedBy: string;
  }): Promise<{ processed: number; delivered: number; failed: number }> {
    const nowIso = new Date().toISOString();

    // 1) buscar candidatos listos
    const { data: rows, error: selErr } = await this.client
      .from("event_outbox")
      .select("*")
      .in("status", ["pending", "failed"])
      .lte("next_retry_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(input.maxEvents)
      .returns<OutboxEventRow[]>();

    if (selErr) throw selErr;

    const events = rows ?? [];
    if (events.length === 0) return { processed: 0, delivered: 0, failed: 0 };

    let delivered = 0;
    let failed = 0;

    for (const ev of events) {
      // 2) lock best-effort (si otro worker lo agarró, skip)
      const { data: locked, error: lockErr } = await this.client
        .from("event_outbox")
        .update({
          status: "processing",
          locked_at: new Date().toISOString(),
          locked_by: input.lockedBy,
        })
        .eq("id", ev.id)
        .in("status", ["pending", "failed"])
        .select("id")
        .maybeSingle<{ id: string }>();

      if (lockErr) {
        this.logger.error("outbox lock failed", {
          eventId: ev.id,
          message: lockErr.message,
        });
        failed += 1;
        continue;
      }
      if (!locked) continue; // alguien más lo lockeó

      try {
        const matching = this.handlers.filter((h) =>
          h.canHandle(ev.event_type),
        );

        for (const handler of matching) {
          const inserted = await tryInsertDelivery({
            client: this.client,
            eventId: ev.id,
            handler: handler.name,
            attempt: ev.attempts + 1,
          });

          if (!inserted) {
            // ya entregado para este handler => idempotencia
            continue;
          }

          await handler.handle({ event: ev });
        }

        // 3) marcar delivered
        const { error: doneErr } = await this.client
          .from("event_outbox")
          .update({
            status: "delivered",
            attempts: ev.attempts + 1,
            locked_at: null,
            locked_by: null,
            next_retry_at: new Date().toISOString(),
          })
          .eq("id", ev.id);

        if (doneErr) throw doneErr;

        delivered += 1;
      } catch (err) {
        const minutes = backoffMinutes(ev.attempts);
        const next = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        const message = err instanceof Error ? err.message : "unknown error";

        // update delivery row to failed (si existía)
        await this.client
          .from("event_deliveries")
          .update({ status: "failed", last_error: message })
          .eq("event_id", ev.id);

        const { error: failErr } = await this.client
          .from("event_outbox")
          .update({
            status: "failed",
            attempts: ev.attempts + 1,
            next_retry_at: next,
            locked_at: null,
            locked_by: null,
          })
          .eq("id", ev.id);

        if (failErr) {
          this.logger.error("outbox mark failed failed", {
            eventId: ev.id,
            message: failErr.message,
          });
        }

        this.logger.warn("outbox event failed", {
          eventId: ev.id,
          nextRetryAt: next,
          error: message,
        });
        failed += 1;
      }
    }

    return { processed: events.length, delivered, failed };
  }
}
