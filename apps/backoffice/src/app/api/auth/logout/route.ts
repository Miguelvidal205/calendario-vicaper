import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http/errorResponse";

export async function POST() {
  try {
    const sb = await supabaseServer();
    await sb.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
