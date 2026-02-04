import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { bookingId, status, note } = (await req.json()) as {
    bookingId: string;
    status: "completed" | "no_show";
    note?: string;
  };

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("agent_update_booking_status", {
    p_booking_id: bookingId,
    p_status: status,
    p_outcome_note: note || null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
