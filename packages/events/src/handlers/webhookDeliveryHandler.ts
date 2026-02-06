import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@vicaper/observability";
import type { EventHandler, OutboxEventRow } from "./types";

type WebhookRow = {
  id: string;
  terreno_id: string;
  event_type: string;
  url: string;
  is_active: boolean;
  secret: string | null;
};

export function createWebhookDeliveryHandler(args: {
  client: SupabaseClient;
  logger: Logger;
  fetchFn?: typeof fetch;
}): EventHandler {
  const fetchFn = args.fetchFn ?? fetch;

  return {
    name: "webhook_delivery_v1",
    canHandle: () => true, // entrega para cualquier evento; filtra por terreno_webhooks.event_type
    async handle({ event }: { event: OutboxEventRow }) {
      const { data, error } = await args.client
        .from("terreno_webhooks")
        .select("id, terreno_id, event_type, url, is_active, secret")
        .eq("terreno_id", event.terreno_id)
        .eq("event_type", event.event_type)
        .eq("is_active", true)
        .returns<WebhookRow[]>();

      if (error) {
        args.logger.error("webhook handler: failed to load webhooks", {
          message: error.message,
        });
        throw error;
      }

      const hooks = data ?? [];
      if (hooks.length === 0) return;

      // fan-out: si falla 1 webhook, consideramos handler fail (retry del evento).
      for (const hook of hooks) {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-vicaper-event": event.event_type,
          "x-vicaper-event-id": event.id,
        };
        // (futuro) firma; por ahora solo forward del secret si existe
        if (hook.secret) headers["x-vicaper-webhook-secret"] = hook.secret;

        const res = await fetchFn(hook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(event.payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Webhook failed (${res.status}) ${hook.url} ${text}`);
        }
      }
    },
  };
}
