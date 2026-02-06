import { AppointmentService } from "@vicaper/domain";
import { SupabaseAppointmentRepository } from "@vicaper/infra-supabase";
import { OutboxEventBus } from "@vicaper/events";
import { consoleLogger } from "@vicaper/observability";
import { supabaseServer } from "../supabase/server";

function newUuid(): string {
  return crypto.randomUUID();
}

export async function makeSchedulingService() {
  const client = await supabaseServer();
  const logger = consoleLogger;

  const repo = new SupabaseAppointmentRepository({ client, logger });
  const events = new OutboxEventBus({ client, logger });

  return new AppointmentService({
    repo,
    events,
    newId: newUuid,
  });
}
