import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) throw new Error("UNAUTHORIZED");

    const terrenoId = await requireActiveTerrenoId();

    // 1. Obtenemos miembros incluyendo su color y horarios
    const { data: members, error: memberErr } = await sb
      .from("terreno_members")
      .select("user_id, role, working_hours, color")
      .eq("terreno_id", terrenoId)
      .order("role", { ascending: true });

    if (memberErr) throw new Error(memberErr.message);
    if (!members || members.length === 0)
      return NextResponse.json({ users: [] });

    const userIds = members.map((m) => m.user_id);

    // 2. Obtenemos perfiles
    const { data: profiles, error: profErr } = await sb
      .from("profiles")
      .select("id, email, full_name, phone")
      .in("id", userIds);

    if (profErr) throw new Error(profErr.message);

    // 3. Mapeamos incluyendo el color
    const users = members.map((member) => {
      const profile = profiles?.find((p) => p.id === member.user_id);
      return {
        id: member.user_id,
        email: profile?.email || "Sin correo",
        name: profile?.full_name || "Sin nombre",
        phone: profile?.phone || "",
        role: member.role,
        workingHours: member.working_hours,
        color: member.color || "#3b82f6", // Azul por defecto si no tiene
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) throw new Error("UNAUTHORIZED");

    const terrenoId = await requireActiveTerrenoId();

    // Validar Admin
    const { data: callerData } = await sb
      .from("terreno_members")
      .select("role")
      .eq("terreno_id", terrenoId)
      .eq("user_id", userRes.user.id)
      .single();

    if (callerData?.role !== "admin") {
      return NextResponse.json(
        { error: { message: "Solo administradores." } },
        { status: 403 },
      );
    }

    // Extraemos el color enviado desde el frontend
    const { email, password, name, phone, role, workingHours, color } =
      await request.json();
    if (!email || !password || !name || !role)
      throw new Error("Faltan datos requeridos.");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, phone: phone || "" },
      });

    if (authError) throw new Error(authError.message);
    const newUserId = authData.user.id;

    const hoursToSave = role === "agent" ? workingHours : null;

    // Insertamos en terreno_members con el nuevo color
    const { error: memberError } = await supabaseAdmin
      .from("terreno_members")
      .insert({
        terreno_id: terrenoId,
        user_id: newUserId,
        role,
        working_hours: hoursToSave,
        color: color || "#3b82f6",
      });

    if (memberError) throw new Error(memberError.message);

    return NextResponse.json({ success: true, userId: newUserId });
  } catch (err: any) {
    return jsonError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) throw new Error("UNAUTHORIZED");

    const terrenoId = await requireActiveTerrenoId();

    // Validar Admin
    const { data: callerData } = await sb
      .from("terreno_members")
      .select("role")
      .eq("terreno_id", terrenoId)
      .eq("user_id", userRes.user.id)
      .single();

    if (callerData?.role !== "admin") {
      return NextResponse.json(
        { error: { message: "Solo administradores." } },
        { status: 403 },
      );
    }

    // Extraemos el color enviado desde el frontend
    const { id, name, phone, role, workingHours, color } = await request.json();
    if (!id || !name || !role)
      throw new Error("Faltan datos requeridos para actualizar.");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        user_metadata: { full_name: name, phone: phone || "" },
      },
    );
    if (authError) throw new Error(`Auth Error: ${authError.message}`);

    const { error: profError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: name, phone: phone || "" })
      .eq("id", id);
    if (profError) throw new Error(`Profiles Error: ${profError.message}`);

    const hoursToSave = role === "agent" ? workingHours : null;

    // Actualizamos terreno_members incluyendo el color
    const { error: memberError } = await supabaseAdmin
      .from("terreno_members")
      .update({
        role,
        working_hours: hoursToSave,
        color: color || "#3b82f6",
      })
      .eq("terreno_id", terrenoId)
      .eq("user_id", id);

    if (memberError) throw new Error(`Members Error: ${memberError.message}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return jsonError(err);
  }
}
