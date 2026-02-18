import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    // 1. Validar que exista la key del booking
    if (!key) {
      return NextResponse.json(
        { message: "Missing booking key" },
        { status: 400 },
      );
    }

    const admin = supabaseAdmin();

    // 2. Buscamos el proyecto (terreno) y su configuración estética + horaria
    // Nota: Agregamos 'working_hours' a la consulta
    const { data, error } = await admin
      .from("terrenos")
      .select(
        `
        id,
        booking_enabled,
        terreno_booking_settings (
          primary_color,
          background_color,
          logo_url,
          working_hours
        )
      `,
      )
      .eq("slug", slug)
      .single();

    // 3. Validaciones de existencia
    if (error || !data) {
      return NextResponse.json(
        { message: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    // 4. Validar que el sistema de reservas esté activo para este cliente
    if (!data.booking_enabled) {
      return NextResponse.json(
        { message: "El sistema de reservas está temporalmente deshabilitado" },
        { status: 403 },
      );
    }

    // Opcional: Aquí puedes añadir una consulta extra a 'terreno_booking_keys'
    // para validar que la 'key' de la URL sea válida antes de entregar los settings.

    const settings = data.terreno_booking_settings as any;

    // 5. Respuesta estructurada
    return NextResponse.json({
      config: {
        // Branding
        primaryColor: settings?.primary_color ?? "#2563eb",
        backgroundColor: settings?.background_color ?? "#ffffff",
        logoUrl: settings?.logo_url ?? "",

        // Horarios Dinámicos:
        // Se espera un JSON tipo: { "monday": { "start": "09:00", "end": "18:00", "closed": false }, ... }
        workingHours: settings?.working_hours ?? null,
      },
    });
  } catch (e: any) {
    console.error("[SETTINGS_ERROR]:", e);
    return jsonError(e);
  }
}
