import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { consoleLogger, newRequestId } from "@vicaper/observability";
import { OutboxProcessor, createWebhookDeliveryHandler } from "@vicaper/events";
import { jsonError } from "@/lib/http/errorResponse";

function verifyJobSecret(req: Request) {
  const expected = process.env.VICAPER_JOB_SECRET ?? "";
  if (!expected) return true; // dev only
  const got = req.headers.get("x-job-secret") ?? "";
  return got === expected;
}

export async function POST(req: Request) {
  try {
    if (!verifyJobSecret(req)) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid job secret" } },
        { status: 401 },
      );
    }

    const client = supabaseAdmin();
    const logger = consoleLogger;

    const processor = new OutboxProcessor({
      client,
      logger,
      handlers: [createWebhookDeliveryHandler({ client, logger })],
    });

    const result = await processor.processBatch({
      maxEvents: 20,
      lockedBy: newRequestId(),
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return jsonError(err);
  }
}
