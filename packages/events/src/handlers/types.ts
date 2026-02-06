export interface OutboxEventRow {
  id: string;
  terreno_id: string;
  event_type: string;
  payload: unknown;
  status: "pending" | "processing" | "delivered" | "failed";
  attempts: number;
  next_retry_at: string;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventHandler {
  name: string; // único para idempotencia
  canHandle(eventType: string): boolean;
  handle(args: { event: OutboxEventRow }): Promise<void>;
}
