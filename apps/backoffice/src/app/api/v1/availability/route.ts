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
    const rawUserId = url.searchParams.get("assignedUserId") ?? "";
    const rawFrom = url.searchParams.get("from") ?? "";
    const rawTo = url.searchParams.get("to") ?? "";

    // 🌟 CASO 1: El Administrador quiere ver la agenda de TODOS
    if (rawUserId === "all") {
      // Consultamos a Supabase omitiendo el filtro de assigned_user_id
      const { data, error } = await sb
        .from("appointments")
        .select("*")
        .eq("terreno_id", terrenoId)
        .gte("starts_at", rawFrom)
        .lte("starts_at", rawTo);

      if (error) throw new Error(error.message);

      // Mapeamos los datos de snake_case (DB) a camelCase (lo que espera toDto)
      const allItems = data.map((row: any) => ({
        id: row.id,
        terrenoId: row.terreno_id,
        assignedUserId: row.assigned_user_id,
        leadId: row.lead_id,
        title: row.title,
        notes: row.notes,
        status: row.status,
        startsAt: new Date(row.starts_at),
        endsAt: new Date(row.ends_at),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      // Usamos el validador de respuesta original para mantener la consistencia
      const response = AvailabilityResponse.parse({
        appointments: allItems.map(toDto),
      });

      return NextResponse.json(response);
    }

    // 🌟 CASO 2: Flujo normal (El Agente viendo su propia agenda)
    const raw = {
      assignedUserId: rawUserId,
      from: rawFrom,
      to: rawTo,
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
