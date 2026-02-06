import { NextResponse } from "next/server";
import { AvailabilityQuery, AvailabilityResponse } from "@vicaper/contracts";
import { makeSchedulingService } from "@/lib/compose/makeSchedulingService";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";
import { supabaseServer } from "@/lib/supabase/server";

function toDto(a: any) {
  return {
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
  };
}

export async function GET(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const terrenoId = await requireActiveTerrenoId();

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
      appointments: items.map(toDto),
    });

    return NextResponse.json(response);
  } catch (err) {
    return jsonError(err);
  }
}
