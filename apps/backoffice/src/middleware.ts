import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value;
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  // Proteger dashboard
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    if (!data.user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  // Si alguien entra a /login ya logueado, mandarlo a onboarding
  if (req.nextUrl.pathname === "/login") {
    if (data.user) {
      const to = req.nextUrl.clone();
      to.pathname = "/dashboard/onboarding";
      return NextResponse.redirect(to);
    }
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
