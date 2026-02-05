"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

// Helper para limpiar los datos del FormData
function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function createBooking(formData: FormData) {
  const cookieStore = await cookies();
  const terrenoId = cookieStore.get("active_terreno_id")?.value;

  if (!terrenoId) {
    throw new Error(
      "No hay un terreno activo seleccionado. Por favor selecciona uno en el sidebar.",
    );
  }

  const supabase = await supabaseServer();

  // 1. Extraer datos del formulario
  const assigned_staff_id = asString(formData.get("assigned_staff_id")).trim();
  const client_name = asString(formData.get("client_name")).trim();
  const client_phone = asString(formData.get("client_phone")).trim();
  const client_email = asString(formData.get("client_email")).trim();
  const notes = asString(formData.get("notes")).trim();

  const date = asString(formData.get("date")).trim(); // YYYY-MM-DD
  const start = asString(formData.get("start")).trim(); // HH:MM
  let end = asString(formData.get("end")).trim(); // HH:MM (opcional)

  // 2. Validaciones básicas
  if (!client_name) throw new Error("El nombre del cliente es obligatorio.");
  if (!date || !start)
    throw new Error("La fecha y hora de inicio son obligatorias.");

  // 3. Lógica de cálculo automático de hora de fin (si no se proporciona)
  // Esto permite que el formulario sea más rápido de llenar.
  if (!end || end === "" || end === "calculated") {
    const [hours, minutes] = start.split(":").map(Number);
    // Añadimos 1 hora por defecto para la visita
    const endHour = String(hours + 1).padStart(2, "0");
    end = `${endHour}:${String(minutes).padStart(2, "0")}`;
  }

  // 4. Construcción de Timestamps ISO para Supabase
  const starts_at = new Date(`${date}T${start}:00`).toISOString();
  const ends_at = new Date(`${date}T${end}:00`).toISOString();

  // 5. Ejecución en Base de Datos (RPC)
  // Usamos las funciones que ya tienes definidas en tu base de datos
  if (!assigned_staff_id) {
    // Caso: Rotación automática (50/50)
    const { error } = await supabase.rpc("admin_create_booking_auto", {
      p_terreno_id: terrenoId,
      p_client_name: client_name,
      p_client_phone: client_phone || null,
      p_client_email: client_email || null,
      p_notes: notes || null,
      p_starts_at: starts_at,
      p_ends_at: ends_at,
    });
    if (error)
      throw new Error(`Error en asignación automática: ${error.message}`);
  } else {
    // Caso: Asignación manual de un agente
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
    if (error) throw new Error(`Error en asignación manual: ${error.message}`);
  }

  // 6. Revalidación de caché para actualizar la UI instantáneamente
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/my-appointments");
  revalidatePath("/dashboard/calendars");
}
