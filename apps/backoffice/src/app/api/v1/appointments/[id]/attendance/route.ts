import { NextResponse } from "next/server";
import {
  MarkAttendanceRequest,
  MarkAttendanceResponse,
} from "@vicaper/contracts";
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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
    const { id: appointmentId } = await ctx.params;

    const body = await req.json();
    const parsed = MarkAttendanceRequest.parse(body);

    const service = await makeSchedulingService();
    const updated = await service.markAttendance({
      terrenoId,
      appointmentId,
      status: parsed.status,
    });

    const response = MarkAttendanceResponse.parse({
      appointment: toDto(updated),
    });
    return NextResponse.json(response);
  } catch (err) {
    return jsonError(err);
  }
}
