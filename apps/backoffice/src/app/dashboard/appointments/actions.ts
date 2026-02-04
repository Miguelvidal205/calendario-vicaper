"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function createBooking(formData: FormData) {
  const cookieStore = await cookies();
  const terrenoId = cookieStore.get("active_terreno_id")?.value;
  if (!terrenoId) throw new Error("No active terreno selected");

  const assigned_staff_id = asString(formData.get("assigned_staff_id")).trim(); // puede ser ""
  const client_name = asString(formData.get("client_name")).trim();
  const client_phone = asString(formData.get("client_phone")).trim();
  const client_email = asString(formData.get("client_email")).trim();
  const notes = asString(formData.get("notes")).trim();

  const date = asString(formData.get("date")).trim(); // YYYY-MM-DD
  const start = asString(formData.get("start")).trim(); // HH:MM
  const end = asString(formData.get("end")).trim(); // HH:MM

  if (!client_name) throw new Error("Nombre del cliente requerido");
  if (!date || !start || !end) throw new Error("Fecha/hora requerida");

  const starts_at = new Date(`${date}T${start}:00`).toISOString();
  const ends_at = new Date(`${date}T${end}:00`).toISOString();

  const supabase = await supabaseServer();

  if (!assigned_staff_id) {
    // ✅ Auto 50/50
    const { error } = await supabase.rpc("admin_create_booking_auto", {
      p_terreno_id: terrenoId,
      p_client_name: client_name,
      p_client_phone: client_phone || null,
      p_client_email: client_email || null,
      p_notes: notes || null,
      p_starts_at: starts_at,
      p_ends_at: ends_at,
    });
    if (error) throw new Error(error.message);
  } else {
    // ✅ Manual
    const { error } = await supabase.rpc("admin_create_booking", {
      p_terreno_id: terrenoId,
      p_assigned_staff_id: assigned_staff_id,
      p_client_name: client_name,
      p_client_phone: client_phone || null,
      p_client_email: client_email || null,
      p_notes: notes || null,
      p_starts_at: starts_at,
      p_ends_at: ends_at,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/my-appointments");
}
