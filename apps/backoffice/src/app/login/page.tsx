"use client";

import { useState } from "react";

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const code = data?.error?.code ?? "REQUEST_FAILED";
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(`${code}: ${message}`);
  }
  return data as T;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function login() {
    setMsg("");
    setLoading(true);
    try {
      await jsonFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // Si ya tienes terreno activo, /dashboard/scheduling funcionará.
      // Si no, onboarding lo resuelve.
      window.location.href = "/dashboard/onboarding";
    } catch (e) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, Arial" }}>
      <div style={{ width: 420, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h1 style={{ marginTop: 0 }}>Login</h1>
        <p style={{ color: "#666", marginTop: 0 }}>VICAPER Backoffice</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Email</label>
            <input
              style={{ width: "100%" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Password</label>
            <input
              style={{ width: "100%" }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button disabled={loading} onClick={login}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          {msg ? (
            <div style={{ padding: 10, border: "1px solid #eee", background: "#fafafa", borderRadius: 8 }}>{msg}</div>
          ) : null}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "#777" }}>
          Usuarios se crean en Supabase (sin confirmación por ahora).
        </div>
      </div>
    </div>
  );
}
