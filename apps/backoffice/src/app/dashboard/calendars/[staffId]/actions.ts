"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function asInt(v: FormDataEntryValue | null, fallback: number) {
  const n = Number(asString(v));
  return Number.isFinite(n) ? n : fallback;
}

function ensureTimeHHMM(value: string) {
  // acepta "HH:MM" o "HH:MM:SS"
  const v = value.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  throw new Error("Formato de hora inválido. Usa HH:MM");
}

export async function ensureCalendarSettings(staffId: string) {
  const supabase = await supabaseServer();

  const { data: existing, error: selectErr } = await supabase
    .from("calendar_settings")
    .select("id")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (selectErr) throw new Error(selectErr.message);
  if (existing) return;

  const { error } = await supabase.from("calendar_settings").insert({
    staff_id: staffId,
    timezone: "America/Argentina/Buenos_Aires",
    slot_minutes: 30,
    buffer_minutes: 0,
    min_notice_minutes: 120,
    max_days_ahead: 30,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${staffId}`);
}

export async function saveCalendarSettings(
  staffId: string,
  formData: FormData,
) {
  const timezone =
    asString(formData.get("timezone")) || "America/Argentina/Buenos_Aires";
  const slot_minutes = asInt(formData.get("slot_minutes"), 30);
  const buffer_minutes = asInt(formData.get("buffer_minutes"), 0);
  const min_notice_minutes = asInt(formData.get("min_notice_minutes"), 120);
  const max_days_ahead = asInt(formData.get("max_days_ahead"), 30);

  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("calendar_settings")
    .update({
      timezone,
      slot_minutes,
      buffer_minutes,
      min_notice_minutes,
      max_days_ahead,
    })
    .eq("staff_id", staffId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${staffId}`);
}

export async function addAvailabilityRule(staffId: string, formData: FormData) {
  const day_of_week = asInt(formData.get("day_of_week"), 1);
  const start_time = ensureTimeHHMM(asString(formData.get("start_time")));
  const end_time = ensureTimeHHMM(asString(formData.get("end_time")));

  if (start_time >= end_time)
    throw new Error("La hora de inicio debe ser menor a la hora de fin.");

  const supabase = await supabaseServer();

  const { error } = await supabase.from("availability_rules").insert({
    staff_id: staffId,
    day_of_week,
    start_time,
    end_time,
    is_enabled: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${staffId}`);
}

export async function deleteAvailabilityRule(staffId: string, ruleId: string) {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("availability_rules")
    .delete()
    .eq("id", ruleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${staffId}`);
}

export async function toggleAvailabilityRule(
  staffId: string,
  ruleId: string,
  nextValue: boolean,
) {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("availability_rules")
    .update({ is_enabled: nextValue })
    .eq("id", ruleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${staffId}`);
}
