import { NextResponse } from "next/server";
import { AvailabilityQuery, AvailabilityResponse } from "@vicaper/contracts";
import { jsonError } from "@/lib/http/errorResponse";
import { requireApiKeyTerreno } from "@/lib/apiKeys/requireApiKey";
import { makeSchedulingService } from "@/lib/compose/makeSchedulingService";

export async function GET(req: Request) {
  try {
    const { terrenoId } = await requireApiKeyTerreno(req);

    const url = new URL(req.url);
    const raw = {
      assignedUserId: url.searchParams.get("assignedUserId") ?? "",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
    };

    const parsed = AvailabilityQuery.parse(raw);
    const service = await makeSchedulingService();

    const items = await service.availability({
      terrenoId,
      assignedUserId: parsed.assignedUserId,
      from: new Date(parsed.from),
      to: new Date(parsed.to),
    });

    const response = AvailabilityResponse.parse({
      appointments: items.map((a: any) => ({
        id: a.id,
        terrenoId: a.terrenoId,
        assignedUserId: a.assignedUserId,
        ...(a.leadId ? { leadId: a.leadId } : {}),
        ...(a.title ? { title: a.title } : {}),
        ...(a.notes ? { notes: a.notes } : {}),
        status: a.status,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    });

    return NextResponse.json(response);
  } catch (err) {
    return jsonError(err);
  }
}
