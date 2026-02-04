import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { terrenoId } = (await req.json()) as { terrenoId: string };

  const res = NextResponse.json({ ok: true });
  res.cookies.set("active_terreno_id", terrenoId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
