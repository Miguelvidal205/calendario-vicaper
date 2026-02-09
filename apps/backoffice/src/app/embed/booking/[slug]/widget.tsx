// apps/backoffice/src/app/embed/booking/[slug]/widget.tsx
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
  const [date, setDate] = useState<string>(todayLocalYYYYMMDD());
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [doneId, setDoneId] = useState<string | null>(null);

  // bookingKey: lo más simple es pasarlo por query param del iframe:
  // <iframe src="https://tuapp.com/embed/booking/mi-terreno?key=XXXX" />
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

  if (doneId) {
    return (
      <section>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Reserva confirmada ✅</h1>
        <p style={{ color: "#334155" }}>
          Tu cita fue creada correctamente.
        </p>
        <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
          ID: {doneId}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Reserva tu visita</h1>
      <p style={{ color: "#475569", marginBottom: 16 }}>
        Elige una fecha y un horario disponible.
      </p>

      <label style={{ display: "block", marginBottom: 8, fontSize: 12, color: "#334155" }}>
        Fecha
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          marginBottom: 16,
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#334155", marginBottom: 8 }}>Horarios</div>

        {loading ? (
          <div style={{ color: "#64748b" }}>Cargando…</div>
        ) : slots.length === 0 ? (
          <div style={{ color: "#64748b" }}>No hay horarios disponibles para este día.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {slots.map((s) => {
              const active = selected?.startsAt === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  onClick={() => setSelected(s)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    border: active ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: active ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
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
        <div style={{ fontSize: 12, color: "#334155", marginBottom: 8 }}>Tus datos</div>

        <input
          placeholder="Nombre y apellido"
          value={visitorName}
          onChange={(e) => setVisitorName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 8 }}
        />
        <input
          placeholder="Email"
          value={visitorEmail}
          onChange={(e) => setVisitorEmail(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 8 }}
        />
        <input
          placeholder="Teléfono"
          value={visitorPhone}
          onChange={(e) => setVisitorPhone(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 8 }}
        />
        <textarea
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", minHeight: 80 }}
        />
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <button
        onClick={submit}
        disabled={loading}
        style={{
          marginTop: 16,
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "none",
          background: "#2563eb",
          color: "#fff",
          cursor: "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        Confirmar reserva
      </button>

      <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
        * Se mostrará dentro de un iframe en tu sitio.
      </div>
    </section>
  );
}
