"use client";

import { useEffect, useMemo, useState } from "react";

type Slot = { startsAt: string; endsAt: string };

function todayLocalYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function BookingWidget(props: { slug: string }) {
  // Calculamos la fecha mínima permitida (hoy)
  const minDate = useMemo(() => todayLocalYYYYMMDD(), []);
  
  const [date, setDate] = useState<string>(minDate);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [doneId, setDoneId] = useState<string | null>(null);

  const bookingKey = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    return u.searchParams.get("key") ?? "";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setSelected(null);

      try {
        const res = await fetch(`/api/v1/public/booking/${props.slug}/availability?date=${date}`, {
          method: "GET",
          headers: { "content-type": "application/json" },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "Error loading availability");

        if (!cancelled) setSlots((data.slots ?? []) as Slot[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [date, props.slug]);

  async function submit() {
    setError(null);

    if (!selected) return setError("Selecciona un horario.");
    if (!bookingKey) return setError("Falta booking key (param ?key=...).");
    if (visitorName.trim().length < 2) return setError("Nombre inválido.");
    if (!visitorEmail.includes("@")) return setError("Email inválido.");
    if (visitorPhone.trim().length < 5) return setError("Teléfono inválido.");

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/public/booking/${props.slug}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: selected.startsAt,
          visitorName,
          visitorEmail,
          visitorPhone,
          notes: notes ? notes : undefined,
          bookingKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "No se pudo reservar");

      setDoneId(String(data.appointmentId));
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: 10, borderRadius: 10,
    border: "1px solid #e2e8f0", marginBottom: 8,
    boxSizing: "border-box" as const, fontSize: "14px"
  };

  if (doneId) {
    return (
      <section style={{ textAlign: 'center', padding: 20 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Reserva confirmada ✅</h1>
        <p style={{ color: "#334155" }}>Tu cita fue creada correctamente.</p>
        <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>ID: {doneId}</div>
      </section>
    );
  }

  return (
    <section style={{ fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8, color: "#0f172a", fontWeight: 700 }}>Reserva tu visita</h1>
      <p style={{ color: "#475569", marginBottom: 16, fontSize: 14 }}>Elige una fecha y un horario disponible.</p>

      <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#334155" }}>
        Fecha
      </label>
      <input
        type="date"
        min={minDate} // VALIDACIÓN: Impide seleccionar fechas pasadas
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{
          width: "100%", padding: 10, borderRadius: 10,
          border: "1px solid #e2e8f0", marginBottom: 16,
          fontFamily: "inherit"
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Horarios</div>

        {loading ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Cargando…</div>
        ) : slots.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13, background: "#f1f5f9", padding: 10, borderRadius: 8 }}>No hay horarios disponibles para este día.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {slots.map((s) => {
              const active = selected?.startsAt === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  onClick={() => setSelected(s)}
                  style={{
                    padding: "10px 4px", borderRadius: 10,
                    border: active ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: active ? "#eff6ff" : "#fff",
                    cursor: "pointer", fontSize: 12,
                    color: active ? "#1d4ed8" : "#334155", fontWeight: active ? 600 : 400
                  }}
                >
                  {formatTime(s.startsAt)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 12 }}>Tus datos</div>
        
        <input placeholder="Nombre y apellido" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} style={inputStyle} />
        <input placeholder="Email" type="email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} style={inputStyle} />
        <input placeholder="Teléfono" type="tel" value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} style={inputStyle} />
        <textarea placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: "none" }} />
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 10, background: "#fef2f2", color: "#b91c1c", fontSize: 13, borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      <button
        onClick={submit}
        disabled={loading}
        style={{
          marginTop: 16, width: "100%", padding: 12, borderRadius: 12, border: "none",
          background: "#2563eb", color: "#fff", cursor: "pointer",
          opacity: loading ? 0.7 : 1, fontWeight: 600, fontSize: 15
        }}
      >
        {loading ? "Procesando..." : "Confirmar reserva"}
      </button>

      <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
        Powered by Vicaper
      </div>
    </section>
  );
}