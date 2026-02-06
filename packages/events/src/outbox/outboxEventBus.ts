import type { SupabaseClient } from "@supabase/supabase-js";
import type { DomainEvent, EventBus } from "@vicaper/domain";
import type { Logger } from "@vicaper/observability";
import { infraError } from "@vicaper/domain";

export class OutboxEventBus implements EventBus {
  private readonly client: SupabaseClient;
  private readonly logger: Logger;

  constructor(args: { client: SupabaseClient; logger: Logger }) {
    this.client = args.client;
    this.logger = args.logger;
  }

  async publish(event: DomainEvent): Promise<void> {
    // Guardamos payload de forma estable: occurredAt + payload (sin spread de unknown)
    const row = {
      id: event.id,
      terreno_id: event.terrenoId,
      event_type: event.type,
      payload: {
        occurredAt: event.occurredAt.toISOString(),
        payload: event.payload,
      },
      status: "pending",
      next_retry_at: new Date().toISOString(),
      attempts: 0,
    };

    const { error } = await this.client.from("event_outbox").insert(row);

    if (error) {
      this.logger.error("outbox.publish failed", {
        message: error.message,
        code: (error as any).code,
      });
      throw infraError("Failed to publish event", {
        supabase: { message: error.message, code: (error as any).code },
      });
    }
  }
}
