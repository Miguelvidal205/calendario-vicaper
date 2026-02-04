"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}
function asInt(v: FormDataEntryValue | null, fallback = 0) {
  const n = Number(asString(v));
  return Number.isFinite(n) ? n : fallback;
}

export async function createTerreno(formData: FormData) {
  const nombre = asString(formData.get("nombre")).trim();
  const marca = asString(formData.get("marca")).trim();
  const stock = asInt(formData.get("stock"), 0);

  if (!nombre) throw new Error("Nombre es requerido");

  const supabase = await supabaseServer();

  const { data: terrenoId, error } = await supabase.rpc(
    "create_terreno_and_assign_owner",
    {
      p_nombre: nombre,
      p_marca: marca || null,
      p_stock: stock,
      p_colores: {},
    },
  );

  if (error) throw new Error(error.message);
  if (!terrenoId)
    throw new Error("No se pudo obtener el ID del terreno creado");

  // ✅ Setear terreno activo inmediatamente
  const cookieStore = await cookies();
  cookieStore.set("active_terreno_id", String(terrenoId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  // ✅ Revalidar páginas + layout del dashboard (para refrescar el selector)
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/terrenos");
  revalidatePath("/dashboard/calendars");

  // ✅ Llevarte directo a Calendarios (ya con terreno activo)
  redirect("/dashboard/calendars");
}
