import { NextResponse } from "next/server";
import {
  CreateAppointmentRequest,
  CreateAppointmentResponse,
} from "@vicaper/contracts";
import { makeSchedulingService } from "@/lib/compose/makeSchedulingService";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";
import { supabaseServer } from "@/lib/supabase/server";

// Helper para el POST (Domain -> DTO)
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

// --- POST: Crear Cita (Interno / Backoffice) ---
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

// --- GET: Listar Citas (Dashboard Admin) ---
// Este endpoint alimenta la tabla de reservas que acabamos de hacer
export async function GET(req: Request) {
  try {
    const sb = await supabaseServer();

    // 1. Validar Auth y Terreno Activo
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const terrenoId = await requireActiveTerrenoId();

    // 2. Parsear Query Params (Filtros opcionales)
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // YYYY-MM-DD

    // 3. Consultar a Supabase (Directo a DB para lectura eficiente de listas)
    // Traemos las columnas nuevas de visitor_*
    let query = sb
      .from("appointments")
      .select(
        `
        id, 
        starts_at, 
        ends_at, 
        status, 
        title, 
        visitor_name, 
        visitor_email, 
        visitor_phone, 
        notes,
        created_at,
        assigned_user_id
      `,
      )
      .eq("terreno_id", terrenoId)
      .order("starts_at", { ascending: false });

    // Filtro por fecha (opcional)
    if (date) {
      // Rango de todo el día en UTC (simplificado)
      query = query
        .gte("starts_at", `${date}T00:00:00`)
        .lte("starts_at", `${date}T23:59:59`);
    } else {
      // Si no hay fecha, limitamos a las últimas 50 para no saturar
      query = query.limit(50);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ appointments: data });
  } catch (err) {
    return jsonError(err);
  }
}
