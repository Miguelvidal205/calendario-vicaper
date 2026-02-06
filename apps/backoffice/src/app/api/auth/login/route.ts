import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http/errorResponse";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const parsed = Body.parse(await req.json());

    const { data, error } = await sb.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: error?.message ?? "Invalid credentials",
          },
        },
        { status: 401 },
      );
    }

    // Cookies ya quedan seteadas por supabaseServer() (ssr client) al hacer signIn
    return NextResponse.json({
      ok: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    return jsonError(err);
  }
}
