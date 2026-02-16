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

    if (!key) {
      return NextResponse.json(
        { message: "Missing booking key" },
        { status: 400 },
      );
    }

    const admin = supabaseAdmin();

    // 1. Buscamos el terreno y su configuración por slug
    const { data, error } = await admin
      .from("terrenos")
      .select(
        `
        id,
        booking_enabled,
        terreno_booking_settings (
        primary_color,
        background_color,
        logo_url
        )
      `,
      )
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    // 2. Validar que el booking esté habilitado
    if (!data.booking_enabled) {
      return NextResponse.json(
        { message: "Booking deshabilitado" },
        { status: 403 },
      );
    }

    // Nota: Aquí podrías agregar la validación de la bookingKey contra
    // la tabla terreno_booking_keys si lo deseas para mayor seguridad.

    const settings = data.terreno_booking_settings as any;

    return NextResponse.json({
      config: {
        primaryColor: settings?.primary_color ?? "#2563eb",
        backgroundColor: settings?.background_color ?? "#ffffff",
        logoUrl: settings?.logo_url ?? "",
      },
    });
  } catch (e: any) {
    return jsonError(e);
  }
}
