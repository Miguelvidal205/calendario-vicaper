"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function linkStaffUser(staffId: string, formData: FormData) {
  const user_id = asString(formData.get("user_id")).trim();

  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("staff_members")
    .update({ user_id: user_id || null })
    .eq("id", staffId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${staffId}`);
}
