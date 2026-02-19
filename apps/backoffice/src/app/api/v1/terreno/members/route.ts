import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";
import { createClient } from "@supabase/supabase-js";

type MemberRow = {
  user_id: string;
  role: "admin" | "agent" | "installer";
};

export async function GET() {
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

    // RLS: el usuario debe poder ver terreno_members del terreno donde pertenece.
    const { data, error } = await sb
      .from("terreno_members")
      .select("user_id, role")
      .eq("terreno_id", terrenoId)
      .order("role", { ascending: true })
      .returns<MemberRow[]>();

    if (error) throw new Error(error.message);

    // MVP: devolvemos solo IDs/roles (sin email) para no depender de auth.users.
    // Luego añadimos profiles table para mostrar nombre/email.
    return NextResponse.json({
      members: data ?? [],
      currentUserId: userRes.user.id,
    });
  } catch (err) {
    return jsonError(err);
  }
}
export async function POST(request: Request) {
  try {
    const sb = await supabaseServer();

    // 1. Validar quién hace la petición
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) throw new Error("UNAUTHORIZED");

    const terrenoId = await requireActiveTerrenoId();

    // 2. Verificar que el usuario actual sea 'admin'
    const { data: callerData } = await sb
      .from("terreno_members")
      .select("role")
      .eq("terreno_id", terrenoId)
      .eq("user_id", userRes.user.id)
      .single();

    if (callerData?.role !== "admin") {
      return NextResponse.json(
        {
          error: { message: "Solo los administradores pueden crear usuarios." },
        },
        { status: 403 },
      );
    }

    // 3. Leer los datos enviados desde el frontend
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      throw new Error("Faltan datos requeridos (email, password, name, role).");
    }

    // 4. Instanciar Supabase con permisos de Admin (Service Role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 5. Crear el usuario en auth.users
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Autoconfirmado para que puedan entrar de inmediato
        user_metadata: { full_name: name }, // Esto activará el Trigger que hicimos en el Paso 1
      });

    if (authError) throw new Error(`Error Auth: ${authError.message}`);

    const newUserId = authData.user.id;

    // 6. Asignar el usuario al Terreno activo con su rol
    const { error: memberError } = await supabaseAdmin
      .from("terreno_members")
      .insert({
        terreno_id: terrenoId,
        user_id: newUserId,
        role: role,
      });

    if (memberError)
      throw new Error(`Error Asignación: ${memberError.message}`);

    return NextResponse.json({ success: true, userId: newUserId });
  } catch (err: any) {
    return jsonError(err);
  }
}
