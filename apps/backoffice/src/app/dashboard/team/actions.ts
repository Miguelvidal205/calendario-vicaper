"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

function mustTerrenoId() {
  return cookies().then((c) => {
    const tid = c.get("active_terreno_id")?.value;
    if (!tid) throw new Error("No active terreno selected");
    return tid;
  });
}

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function addMemberByUserId(formData: FormData) {
  const terrenoId = await mustTerrenoId();
  const userId = asString(formData.get("user_id")).trim();
  const role = asString(formData.get("role")).trim() || "staff";

  if (!userId) throw new Error("user_id requerido");

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("terreno_add_existing_user", {
    p_terreno_id: terrenoId,
    p_user_id: userId,
    p_role: role,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team");
}

export async function setMemberRole(userId: string, role: string) {
  const terrenoId = await mustTerrenoId();

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("terreno_set_user_role", {
    p_terreno_id: terrenoId,
    p_user_id: userId,
    p_role: role,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team");
}

export async function removeMember(userId: string) {
  const terrenoId = await mustTerrenoId();

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("terreno_remove_user", {
    p_terreno_id: terrenoId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team");
}
