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

export default function OnboardingPage() {
  const [name, setName] = useState("Terreno Demo");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function createTerreno() {
    setMsg("");
    setLoading(true);
    try {
      await jsonFetch<{ terreno: { id: string; name: string } }>("/api/v1/terrenos", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      // cookie ya seteada por el server
      window.location.href = "/dashboard/scheduling";
    } catch (e) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Onboarding</h1>
      <p style={{ color: "#555" }}>Crea tu primer Terreno y te dejamos listo como admin.</p>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 360 }}>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Nombre del Terreno</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </div>

        <button disabled={loading} onClick={createTerreno}>
          {loading ? "Creando..." : "Crear Terreno"}
        </button>
      </div>

      {msg ? <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee", background: "#fafafa" }}>{msg}</div> : null}
    </div>
  );
}
