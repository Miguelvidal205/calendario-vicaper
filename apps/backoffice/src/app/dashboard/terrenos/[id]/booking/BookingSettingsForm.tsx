"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingSettingsDto } from "@vicaper/contracts";

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

  const previewUrl = useMemo(() => {
    // todavía no tenemos booking key UI: dejamos ?key=PEGAR_KEY
    return `/embed/booking/${slug}?key=PEGAR_BOOKING_KEY`;
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [props.terrenoId]);

  function updateRange(day: DayKey, idx: number, patch: Partial<Range>) {
    setWorkingHours((prev) => {
      const next = { ...prev };
      const arr = [...next[day]];
      
      arr[idx] = { ...(arr[idx] as Range), ...(patch as Partial<Range>) } as Range;
      next[day] = arr;
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

  async function save() {
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

      setNotice("Guardado ✅");
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ color: "#64748b" }}>Cargando…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Configuración</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 6 }}>
              Slug (URL)
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.trim())}
              placeholder="mi-terreno"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
            />
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
              Se usa en: <code>/embed/booking/{slug}</code>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 6 }}>
              Timezone
            </label>
            <input
              value={timezone}
              readOnly
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}
            />
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
              Hora fija Chile (sin cambios).
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 6 }}>
              Duración slot (min)
            </label>
            <input
              type="number"
              value={slotDurationMinutes}
              onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 6 }}>
              Buffer (min)
            </label>
            <input
              type="number"
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={bookingEnabled}
              onChange={(e) => setBookingEnabled(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>Booking habilitado</span>
          </label>
        </div>
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Horarios laborales</h2>

        {(Object.keys(DAY_LABEL) as DayKey[]).map((day) => (
          <div key={day} style={{ padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#0f172a" }}>{DAY_LABEL[day]}</div>
              <button
                onClick={() => addRange(day)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                + Agregar rango
              </button>
            </div>

            {workingHours[day].length === 0 ? (
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                Sin horarios.
              </div>
            ) : (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {workingHours[day].map((r, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                    <input
                      value={r.start}
                      onChange={(e) => updateRange(day, idx, { start: e.target.value })}
                      placeholder="09:00"
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
                    />
                    <input
                      value={r.end}
                      onChange={(e) => updateRange(day, idx, { end: e.target.value })}
                      placeholder="18:00"
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
                    />
                    <button
                      onClick={() => removeRange(day, idx)}
                      style={{
                        padding: "0 10px",
                        borderRadius: 10,
                        border: "1px solid #fee2e2",
                        background: "#fff",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Preview (iframe)</h2>

        <div style={{ fontSize: 12, color: "#334155", marginBottom: 8 }}>
          URL de preview:
        </div>
        <code style={{ display: "block", padding: 10, borderRadius: 10, background: "#f8fafc" }}>
          {previewUrl}
        </code>

        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
          Aún falta UI para generar booking key. Por ahora, el preview usa <code>PEGAR_BOOKING_KEY</code>.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={() => window.open(previewUrl, "_blank")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Abrir preview
          </button>

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

        {error ? <div style={{ marginTop: 12, color: "#b91c1c" }}>{error}</div> : null}
        {notice ? <div style={{ marginTop: 12, color: "#166534" }}>{notice}</div> : null}
      </section>
    </div>
  );
}
