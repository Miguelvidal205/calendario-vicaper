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

    const { data: members, error: memberErr } = await sb
      .from("terreno_members")
      .select("user_id, role, working_hours")
      .eq("terreno_id", terrenoId)
      .order("role", { ascending: true });

    if (memberErr) throw new Error(memberErr.message);
    if (!members || members.length === 0)
      return NextResponse.json({ users: [] });

    const userIds = members.map((m) => m.user_id);

    const { data: profiles, error: profErr } = await sb
      .from("profiles")
      .select("id, email, full_name, phone")
      .in("id", userIds);

    if (profErr) throw new Error(profErr.message);

    const users = members.map((member) => {
      const profile = profiles?.find((p) => p.id === member.user_id);
      return {
        id: member.user_id,
        email: profile?.email || "Sin correo",
        name: profile?.full_name || "Sin nombre",
        phone: profile?.phone || "",
        role: member.role,
        workingHours: member.working_hours,
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

    const { email, password, name, phone, role, workingHours } =
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

    // Solo insertamos working_hours si es un agente (field_agent o agent dependiendo de como lo llames)
    const hoursToSave = role === "agent" ? workingHours : null;

    const { error: memberError } = await supabaseAdmin
      .from("terreno_members")
      .insert({
        terreno_id: terrenoId,
        user_id: newUserId,
        role,
        working_hours: hoursToSave,
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

    // Validar que quien ejecuta sea Admin
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

    const { id, name, phone, role, workingHours } = await request.json();
    if (!id || !name || !role)
      throw new Error("Faltan datos requeridos para actualizar.");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1. Actualizar metadatos en auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        user_metadata: { full_name: name, phone: phone || "" },
      },
    );
    if (authError) throw new Error(`Auth Error: ${authError.message}`);

    // 2. Actualizar la tabla pública profiles
    const { error: profError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: name, phone: phone || "" })
      .eq("id", id);
    if (profError) throw new Error(`Profiles Error: ${profError.message}`);

    // 3. Actualizar rol y horarios en terreno_members
    const hoursToSave = role === "agent" ? workingHours : null;
    const { error: memberError } = await supabaseAdmin
      .from("terreno_members")
      .update({ role, working_hours: hoursToSave })
      .eq("terreno_id", terrenoId)
      .eq("user_id", id);
    if (memberError) throw new Error(`Members Error: ${memberError.message}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return jsonError(err);
  }
}
