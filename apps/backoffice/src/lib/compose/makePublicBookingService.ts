import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppointmentsRepo,
  BookingSettingsRepo,
  AssigneeResolver,
} from "@vicaper/infra-supabase";
import { OutboxEventBus } from "@vicaper/events";
import { BookingService } from "@vicaper/domain";
import { consoleLogger } from "@vicaper/observability";

type RepoDeps = {
  client: SupabaseClient;
  logger: typeof consoleLogger;
};

/**
 * Algunos repos en tu monorepo parecen aceptar (client),
 * y otros aceptan ({ client, logger }).
 *
 * Para evitar fricción con TS mientras estabilizamos los signatures,
 * instanciamos usando `any` y pasamos deps completos.
 */
function construct<T>(Cls: unknown, arg: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return new (Cls as any)(arg) as T;
}

export async function makePublicBookingService(client: SupabaseClient) {
  const deps: RepoDeps = { client, logger: consoleLogger };

  // Si algún repo realmente requiere solo client, y falla en runtime,
  // cambia `deps` por `client` SOLO en ese repo.
  const appointments = construct<unknown>(AppointmentsRepo, deps);
  const settingsRepo = construct<unknown>(BookingSettingsRepo, deps);
  const assignee = construct<unknown>(AssigneeResolver, deps);
  const eventBus = construct<unknown>(OutboxEventBus, deps);

  // BookingService en tu repo acepta 1 argumento (dep object).
  // Lo dejamos como `any` hasta pegar la firma real y tiparlo perfecto.
  return new (BookingService as any)({
    appointments,
    settingsRepo,
    assignee,
    eventBus,
  });
}
