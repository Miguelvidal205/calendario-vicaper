import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@vicaper/observability";
import type { EventHandler, OutboxEventRow } from "../handlers/types";
import { EVENT_TYPES, AppointmentCreatedPayload } from "../handlers/types";
import { sendBookingEmailHandler } from "../handlers/sendBookingEmail";

function backoffMinutes(attempts: number): number {
  // schedule: 1m, 2m, 5m, 10m, 30m, 60m
  const schedule = [1, 2, 5, 10, 30, 60];
  return schedule[Math.min(attempts, schedule.length - 1)] ?? 60;
}

/**
 * Intenta insertar un registro en event_deliveries para asegurar idempotencia.
 * Retorna true si se insertó (es la primera vez que se procesa para este handler),
 * Retorna false si ya existía (ya se procesó).
 */
async function tryInsertDelivery(args: {
  client: SupabaseClient;
  eventId: string;
  handler: string;
  attempt: number;
}): Promise<boolean> {
  const { error } = await args.client.from("event_deliveries").insert({
    event_id: args.eventId,
    handler: args.handler,
    status: "success",
    attempt: args.attempt,
  });

  if (!error) return true;

  // Postgres unique_violation code
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

    // 1) Buscar eventos pendientes
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
      // 2) Lock optimista (Best-effort)
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

      if (!locked) continue; // Otro worker lo tomó

      try {
        // --- PROCESAMIENTO DE HANDLERS ---

        // Determinar qué "type" usar (dependiendo de tu DB puede ser 'type' o 'event_type')
        // Asumimos 'type' basado en tu insert anterior, pero hacemos fallback.
        const eventType = (ev as any).type || (ev as any).event_type;

        // A) Handler Específico: Email de Booking
        if (eventType === EVENT_TYPES.APPOINTMENT_CREATED) {
          const handlerName = "sendBookingEmail";

          // Chequeo de idempotencia para este handler específico
          const shouldRun = await tryInsertDelivery({
            client: this.client,
            eventId: ev.id,
            handler: handlerName,
            attempt: ev.attempts + 1,
          });

          if (shouldRun) {
            const payload = ev.payload as unknown as AppointmentCreatedPayload;
            await sendBookingEmailHandler(payload);
          }
        }

        // B) Handlers Genéricos (ej: Webhooks)
        // Esto mantiene vivo tu sistema actual de handlers inyectados
        const matching = this.handlers.filter((h) => h.canHandle(eventType));

        for (const handler of matching) {
          const inserted = await tryInsertDelivery({
            client: this.client,
            eventId: ev.id,
            handler: handler.name,
            attempt: ev.attempts + 1,
          });

          if (!inserted) continue; // Ya procesado por este handler

          await handler.handle({ event: ev });
        }

        // 3) Marcar como entregado (Solo si no hubo errores arriba)
        const { error: doneErr } = await this.client
          .from("event_outbox")
          .update({
            status: "delivered",
            attempts: ev.attempts + 1,
            locked_at: null,
            locked_by: null,
            next_retry_at: new Date().toISOString(), // Opcional: keep current time
            processed_at: new Date().toISOString(),
          })
          .eq("id", ev.id);

        if (doneErr) throw doneErr;

        delivered += 1;
      } catch (err) {
        // Manejo de Errores y Retry
        const minutes = backoffMinutes(ev.attempts);
        const next = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        const message = err instanceof Error ? err.message : "unknown error";

        this.logger.error("outbox processing error", {
          eventId: ev.id,
          error: message,
        });

        // Actualizar el delivery a fallido (si se llegó a crear)
        // Nota: esto es genérico, idealmente sabríamos cuál handler falló específicamente
        await this.client
          .from("event_deliveries")
          .update({ status: "failed", last_error: message })
          .eq("event_id", ev.id)
          .eq("attempt", ev.attempts + 1); // Solo el intento actual

        // Marcar evento principal como fallido para retry
        const { error: failErr } = await this.client
          .from("event_outbox")
          .update({
            status: "failed",
            attempts: ev.attempts + 1,
            next_retry_at: next,
            locked_at: null,
            locked_by: null,
            last_error: message,
          })
          .eq("id", ev.id);

        if (failErr) {
          this.logger.error("outbox mark failed failed", {
            eventId: ev.id,
            message: failErr.message,
          });
        }

        failed += 1;
      }
    }

    return { processed: events.length, delivered, failed };
  }
}
