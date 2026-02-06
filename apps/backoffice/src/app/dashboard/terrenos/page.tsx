"use client";

import { useEffect, useState } from "react";

type Terreno = { id: string; name: string; created_at: string };

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

export default function TerrenosPage() {
  const [terrenos, setTerrenos] = useState<Terreno[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const data = await jsonFetch<{ terrenos: Terreno[] }>("/api/v1/terrenos");
      setTerrenos(data.terrenos ?? []);
    } catch (e) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setActive(terrenoId: string) {
    setMsg("");
    setLoading(true);
    try {
      await jsonFetch<{ ok: true }>("/api/v1/terrenos/active", {
        method: "POST",
        body: JSON.stringify({ terrenoId }),
      });
      window.location.href = "/dashboard/scheduling";
    } catch (e) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ marginTop: 0 }}>Seleccionar Terreno</h1>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button disabled={loading} onClick={load}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
        <a href="/dashboard/onboarding">Crear nuevo terreno</a>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee", background: "#fafafa" }}>{msg}</div>
      ) : null}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {terrenos.map((t) => (
          <div key={t.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "#777", wordBreak: "break-all" }}>{t.id}</div>
            <div style={{ fontSize: 12, color: "#777" }}>{new Date(t.created_at).toLocaleString()}</div>

            <div style={{ marginTop: 10 }}>
              <button disabled={loading} onClick={() => setActive(t.id)}>
                Usar este terreno
              </button>
            </div>
          </div>
        ))}
      </div>

      {terrenos.length === 0 && !loading ? (
        <div style={{ marginTop: 12, color: "#777" }}>
          No tienes terrenos todavía. Ve a <a href="/dashboard/onboarding">Onboarding</a> para crear el primero.
        </div>
      ) : null}
    </div>
  );
}
