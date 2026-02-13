"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingSettingsDto } from "@vicaper/contracts";
import { EmbedDomainsListResponse } from "@vicaper/contracts";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Range = { start: string; end: string };

const DAY_LABEL: Record<DayKey, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

function emptyHours(): Record<DayKey, Range[]> {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

function isHHmm(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

export default function BookingSettingsForm(props: { terrenoId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [slug, setSlug] = useState("demo-terreno");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [timezone] = useState<"America/Santiago">("America/Santiago");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [workingHours, setWorkingHours] = useState<Record<DayKey, Range[]>>(emptyHours());

  const [bookingKey, setBookingKey] = useState<string | null>(null);

  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domains, setDomains] = useState<Array<{ id: string; domain: string; enabled: boolean }>>([]);
  const [newDomain, setNewDomain] = useState("");

  const previewUrl = useMemo(() => {
    const key = bookingKey ?? "PEGAR_BOOKING_KEY";
    return `/embed/booking/${slug}?key=${encodeURIComponent(key)}`;
  }, [slug, bookingKey]);

  const iframeSnippet = useMemo(() => {
    const key = bookingKey ?? "PEGAR_BOOKING_KEY";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const src = `${origin}/embed/booking/${slug}?key=${encodeURIComponent(key)}`;
    return `<iframe src="${src}" style="width:100%;max-width:520px;height:720px;border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`;
  }, [slug, bookingKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const res = await fetch(`/api/v1/terrenos/${props.terrenoId}/booking-settings`, {
          method: "GET",
          headers: { "content-type": "application/json" },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "No se pudo cargar la configuración");

        const dto = data as BookingSettingsDto;

        if (cancelled) return;

        setSlug(dto.slug);
        setBookingEnabled(dto.bookingEnabled);
        setSlotDurationMinutes(dto.slotDurationMinutes);
        setBufferMinutes(dto.bufferMinutes);

        const base = emptyHours();
        const wh = (dto.workingHours ?? {}) as Partial<Record<DayKey, Range[]>>;
        setWorkingHours({
          mon: wh.mon ?? base.mon,
          tue: wh.tue ?? base.tue,
          wed: wh.wed ?? base.wed,
          thu: wh.thu ?? base.thu,
          fri: wh.fri ?? base.fri,
          sat: wh.sat ?? base.sat,
          sun: wh.sun ?? base.sun,
        });

        await reloadDomains();
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.terrenoId]);

  async function reloadDomains() {
    setDomainsLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/terrenos/${props.terrenoId}/embed-domains`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? "No se pudo cargar domains");

      const parsed = EmbedDomainsListResponse.parse(j);
      setDomains(parsed.items);
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setDomainsLoading(false);
    }
  }

  function updateRange(day: DayKey, idx: number, patch: Partial<Range>) {
    setWorkingHours((prev) => {
      const arr = prev[day];
      const current = arr[idx];
      if (!current) return prev;

      const next = { ...prev };
      const copy = [...arr];

      copy[idx] = {
        start: patch.start ?? current.start,
        end: patch.end ?? current.end,
      };

      next[day] = copy;
      return next;
    });
  }

  function addRange(day: DayKey) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: "09:00", end: "18:00" }],
    }));
  }

  function removeRange(day: DayKey, idx: number) {
    setWorkingHours((prev) => {
      const next = { ...prev };
      next[day] = next[day].filter((_, i) => i !== idx);
      return next;
    });
  }

  function validate(): string | null {
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2) {
      return "Slug inválido. Usa solo letras minúsculas, números y guiones.";
    }
    if (slotDurationMinutes < 15 || slotDurationMinutes > 240) return "Duración inválida (15–240).";
    if (bufferMinutes < 0 || bufferMinutes > 60) return "Buffer inválido (0–60).";

    for (const day of Object.keys(DAY_LABEL) as DayKey[]) {
      for (const r of workingHours[day]) {
        if (!isHHmm(r.start) || !isHHmm(r.end)) return `Hora inválida en ${DAY_LABEL[day]}.`;
        if (r.start >= r.end) return `Rango inválido en ${DAY_LABEL[day]} (start >= end).`;
      }
    }
    return null;
  }

  async function saveSettings() {
    setNotice(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/terrenos/${props.terrenoId}/booking-settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          bookingEnabled,
          slotDurationMinutes,
          bufferMinutes,
          workingHours,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data?.code;
        if (code === "SLUG_ALREADY_TAKEN") throw new Error("Ese slug ya está en uso. Prueba otro.");
        throw new Error(data?.message ?? "No se pudo guardar");
      }

      setNotice("Configuración guardada correctamente ✅");
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  async function rotateKey() {
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(`/api/v1/terrenos/${props.terrenoId}/booking-key/rotate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? "No se pudo generar key");
      setBookingKey(String(j.bookingKey));
      setNotice("Nueva booking key generada. Cópiala ahora, no se volverá a mostrar.");
    } catch (e: any) {
      setError(e.message ?? "Error");
    }
  }

  async function addDomain() {
    setError(null);
    setNotice(null);

    const d = newDomain.trim();
    if (!d) return;

    try {
      const r = await fetch(`/api/v1/terrenos/${props.terrenoId}/embed-domains`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d, enabled: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? "No se pudo agregar dominio");

      setNewDomain("");
      await reloadDomains();
      setNotice("Dominio agregado ✅");
    } catch (e: any) {
      setError(e.message ?? "Error");
    }
  }

  async function deleteDomain(domainId: string) {
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(`/api/v1/terrenos/${props.terrenoId}/embed-domains/${domainId}`, {
        method: "DELETE",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? "No se pudo eliminar dominio");
      await reloadDomains();
      setNotice("Dominio eliminado ✅");
    } catch (e: any) {
      setError(e.message ?? "Error");
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setNotice("Copiado al portapapeles ✅");
  }

  if (loading) return <div style={{ color: "var(--text-muted)", padding: 20 }}>Cargando configuración...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
      
      {/* SECCIÓN: Configuración General */}
      <section className="ui-card">
        <h2 className="ui-subtitle">Configuración General</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label className="ui-label">Slug (URL amigable)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.trim())}
              placeholder="mi-terreno"
              className="ui-input"
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Visible en: <code>/embed/booking/{slug}</code>
            </div>
          </div>

          <div>
            <label className="ui-label">Zona Horaria</label>
            <input
              value={timezone}
              readOnly
              className="ui-input"
              style={{ background: "#f1f5f9", color: "#64748b" }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Fijo: Chile Continental</div>
          </div>

          <div>
            <label className="ui-label">Duración slot (min)</label>
            <input
              type="number"
              value={slotDurationMinutes}
              onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
              className="ui-input"
            />
          </div>

          <div>
            <label className="ui-label">Buffer entre citas (min)</label>
            <input
              type="number"
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              className="ui-input"
            />
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
            <input 
                type="checkbox" 
                checked={bookingEnabled} 
                onChange={(e) => setBookingEnabled(e.target.checked)} 
                style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Habilitar Booking Público</span>
          </label>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="ui-btn ui-btn-primary"
            style={{ width: "140px" }}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </section>

      {/* SECCIÓN: Horarios Laborales */}
      <section className="ui-card">
        <h2 className="ui-subtitle">Horarios de Disponibilidad</h2>

        <div style={{ display: "grid", gap: 0 }}>
          {(Object.keys(DAY_LABEL) as DayKey[]).map((day) => (
            <div key={day} style={{ padding: "16px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{DAY_LABEL[day]}</div>
                <button
                  onClick={() => addRange(day)}
                  className="ui-btn"
                  style={{ padding: "4px 10px", fontSize: 12, background: "#f8fafc", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                >
                  + Agregar Horario
                </button>
              </div>

              {workingHours[day].length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No disponible (Cerrado)</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {workingHours[day].map((r, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        value={r.start}
                        onChange={(e) => updateRange(day, idx, { start: e.target.value })}
                        placeholder="09:00"
                        className="ui-input"
                        style={{ maxWidth: 100, textAlign: "center" }}
                      />
                      <span style={{ color: "var(--text-muted)" }}>-</span>
                      <input
                        value={r.end}
                        onChange={(e) => updateRange(day, idx, { end: e.target.value })}
                        placeholder="18:00"
                        className="ui-input"
                        style={{ maxWidth: 100, textAlign: "center" }}
                      />
                      <button
                        onClick={() => removeRange(day, idx)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: 4,
                          fontSize: 18,
                          marginLeft: 8
                        }}
                        title="Eliminar rango"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN: Seguridad */}
      <section className="ui-card">
        <h2 className="ui-subtitle">Seguridad (Booking Key)</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Esta clave es necesaria para que el widget funcione. Si la rotas, deberás actualizar el código embebido en tu sitio web.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={rotateKey} className="ui-btn" style={{ background: "#f8fafc", border: "1px solid var(--border-color)" }}>
            🔄 Generar nueva Key
          </button>
          {bookingKey && (
            <button onClick={() => copy(bookingKey)} className="ui-btn" style={{ background: "#f8fafc", border: "1px solid var(--border-color)" }}>
              📋 Copiar Key
            </button>
          )}
        </div>

        {bookingKey ? (
          <div style={{ marginTop: 16 }}>
            <div className="ui-label">Tu nueva Booking Key:</div>
            <div style={{ background: "#fffbeb", padding: 12, borderRadius: 8, border: "1px solid #fcd34d", fontFamily: "monospace", color: "#b45309", wordBreak: "break-all" }}>
                {bookingKey}
            </div>
            <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                ⚠️ Cópiala ahora. Por seguridad, no se volverá a mostrar completa.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
            (No hay key visible. Si ya tienes una configurada y funciona, no necesitas generar otra a menos que haya sido comprometida).
          </div>
        )}
      </section>

      {/* SECCIÓN: Dominios */}
      <section className="ui-card">
        <h2 className="ui-subtitle">Dominios Permitidos (CORS)</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Especifica qué dominios pueden mostrar tu calendario (ej: <code>localhost:3000</code> o <code>mitiendas.cl</code>).
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="ej: misitio.com"
            className="ui-input"
          />
          <button onClick={addDomain} className="ui-btn" style={{ background: "#0f172a", color: "white" }}>
            Agregar
          </button>
          <button onClick={reloadDomains} disabled={domainsLoading} className="ui-btn" style={{ border: "1px solid var(--border-color)", background: "white" }}>
            ↻
          </button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {domains.length === 0 ? (
             <div style={{ padding: 12, textAlign: "center", background: "#f8fafc", borderRadius: 8, fontSize: 13, color: "var(--text-muted)" }}>
                No hay dominios configurados.
             </div>
          ) : (
              domains.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <span style={{ fontFamily: "monospace", fontSize: 13 }}>{d.domain}</span>
                     <span className={`ui-badge ${d.enabled ? 'completed' : 'cancelled'}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                        {d.enabled ? "ACTIVO" : "INACTIVO"}
                     </span>
                  </div>
                  <button onClick={() => deleteDomain(d.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Eliminar
                  </button>
                </div>
              ))
          )}
        </div>
      </section>

      {/* SECCIÓN: Preview */}
      <section className="ui-card">
        <h2 className="ui-subtitle">Integración</h2>
        
        <div style={{ marginBottom: 16 }}>
            <div className="ui-label">Link Directo / Preview</div>
            <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={previewUrl} className="ui-input" style={{ background: "#f1f5f9", color: "#64748b" }} />
                <button onClick={() => window.open(previewUrl, "_blank")} className="ui-btn" style={{ border: "1px solid var(--border-color)", background: "white" }}>
                    Abrir ↗
                </button>
            </div>
        </div>

        <div>
            <div className="ui-label">Código Iframe (Copiar y pegar)</div>
            <div style={{ position: "relative" }}>
                <textarea 
                    readOnly 
                    value={iframeSnippet} 
                    className="ui-input" 
                    style={{ height: 100, fontFamily: "monospace", fontSize: 12, background: "#0f172a", color: "#e2e8f0", resize: "none" }} 
                />
                <button 
                    onClick={() => copy(iframeSnippet)}
                    className="ui-btn ui-btn-primary"
                    style={{ position: "absolute", bottom: 10, right: 10, padding: "4px 10px", fontSize: 12 }}
                >
                    Copiar Código
                </button>
            </div>
        </div>

        {/* FEEDBACK GLOBAL */}
        <div style={{ marginTop: 20 }}>
            {error && <div className="ui-feedback error">{error}</div>}
            {notice && <div className="ui-feedback success">{notice}</div>}
        </div>
      </section>

    </div>
  );
}