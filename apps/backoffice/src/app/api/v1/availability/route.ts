import { NextResponse } from "next/server";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json(
        { error: { message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const terrenoId = await requireActiveTerrenoId();
    const url = new URL(req.url);
    const rawUserId = url.searchParams.get("assignedUserId") ?? "";
    const rawFrom = url.searchParams.get("from") ?? "";
    const rawTo = url.searchParams.get("to") ?? "";

    // Construimos la consulta directa a Supabase
    let query = sb.from("appointments").select("*").eq("terreno_id", terrenoId);

    // Filtros de fecha
    if (rawFrom) query = query.gte("starts_at", rawFrom);
    if (rawTo) query = query.lte("starts_at", rawTo);

    // Si no es "all", filtramos por el agente
    if (rawUserId && rawUserId !== "all") {
      query = query.eq("assigned_user_id", rawUserId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Mapeamos los datos para el Frontend (incluyendo datos del visitante)
    const appointments = data.map((row: any) => ({
      id: row.id,
      terrenoId: row.terreno_id,
      assignedUserId: row.assigned_user_id,
      title: row.title,
      notes: row.notes,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      visitorName: row.visitor_name,
      visitorEmail: row.visitor_email,
      visitorPhone: row.visitor_phone,
    }));

    return NextResponse.json({ appointments });
  } catch (err) {
    return jsonError(err);
  }
}
