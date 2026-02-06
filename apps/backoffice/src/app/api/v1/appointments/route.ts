import { NextResponse } from "next/server";
import {
  CreateAppointmentRequest,
  CreateAppointmentResponse,
} from "@vicaper/contracts";
import { makeSchedulingService } from "@/lib/compose/makeSchedulingService";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";
import { supabaseServer } from "@/lib/supabase/server";

function toDto(a: {
  id: string;
  terrenoId: string;
  assignedUserId: string;
  leadId?: string;
  title?: string;
  notes?: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
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

export async function POST(req: Request) {
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
    const body = await req.json();
    const parsed = CreateAppointmentRequest.parse(body);

    const service = await makeSchedulingService();

    const created = await service.create({
      terrenoId,
      assignedUserId: parsed.assignedUserId,
      startsAt: new Date(parsed.startsAt),
      ...(parsed.endsAt ? { endsAt: new Date(parsed.endsAt) } : {}),
      ...(parsed.leadId ? { leadId: parsed.leadId } : {}),
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.notes ? { notes: parsed.notes } : {}),
    });

    const response = CreateAppointmentResponse.parse({
      appointment: toDto(created),
    });

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
