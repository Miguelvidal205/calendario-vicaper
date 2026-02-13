"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // Usamos Link para navegación interna optimizada

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
      // Usamos window.location para forzar un refresh completo y que el dashboard recarge el contexto
      window.location.href = "/dashboard/scheduling";
    } catch (e) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-page-container">
      <div className="ui-wrapper">
        
        {/* Header con Acciones */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 className="ui-title">Mis Terrenos</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Selecciona un terreno para gestionar su calendario</p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button 
              disabled={loading} 
              onClick={load}
              className="ui-btn"
              style={{ background: "white", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              {loading ? "Cargando..." : "↻ Refrescar"}
            </button>
            
            <Link href="/dashboard/onboarding" className="ui-btn ui-btn-primary">
              + Nuevo Terreno
            </Link>
          </div>
        </div>

        {/* Mensajes de Error */}
        {msg ? (
          <div className="ui-feedback error" style={{ marginBottom: 24 }}>
            {msg}
          </div>
        ) : null}

        {/* Grid de Tarjetas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {terrenos.map((t) => (
            <div key={t.id} className="ui-card" style={{ marginBottom: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", transition: "transform 0.2s" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                    <div className="ui-subtitle" style={{ fontSize: 18, margin: 0 }}>{t.name}</div>
                    {/* Badge simulado para el ID */}
                    <div style={{ fontSize: 10, background: "#f1f5f9", padding: "4px 6px", borderRadius: 4, color: "#64748b", fontFamily: "monospace" }}>
                        ID: {t.id.slice(0, 8)}...
                    </div>
                </div>
                
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📅 Creado el:</span>
                  <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
                    {new Date(t.created_at).toLocaleDateString("es-CL", { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "auto" }}>
                <button 
                  disabled={loading} 
                  onClick={() => setActive(t.id)}
                  className="ui-btn ui-btn-primary"
                  style={{ width: "100%" }}
                >
                  Gestionar este terreno
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {terrenos.length === 0 && !loading ? (
          <div className="ui-card" style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏞️</div>
            <h3 className="ui-subtitle">No tienes terrenos registrados</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Comienza configurando tu primer proyecto inmobiliario.</p>
            <Link href="/dashboard/onboarding" className="ui-btn ui-btn-primary">
              Comenzar Onboarding
            </Link>
          </div>
        ) : null}

      </div>
    </div>
  );
}