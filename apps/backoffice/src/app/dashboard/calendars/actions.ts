"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function createStaff(formData: FormData) {
  const cookieStore = await cookies();
  const terrenoId = cookieStore.get("active_terreno_id")?.value;

  if (!terrenoId) {
    throw new Error(
      "No active terreno selected (active_terreno_id cookie missing)",
    );
  }

  const name = asString(formData.get("name")).trim();
  const email = asString(formData.get("email")).trim();

  if (!name) throw new Error("Name is required");

  const supabase = await supabaseServer();

  const { error } = await supabase.from("staff_members").insert({
    terreno_id: terrenoId,
    name,
    email: email || null,
    is_active: true,
    weight: 1,
    user_id: null,
  });

  if (error) throw new Error(error.message);

  // Refresca la lista
  revalidatePath("/dashboard/calendars");
}
