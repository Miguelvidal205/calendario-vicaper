"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Slot = { startsAt: string; endsAt: string };
type TakenSlot = { id: string; startsAt: string; endsAt: string };

function fmtChileTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

function fmtChileDateLabel(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function todayChileYMD() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseYMD(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

function startOfMonthUTC(ymd: string) {
  const p = parseYMD(ymd) ?? { y: 1970, m: 1, d: 1 };
  return new Date(Date.UTC(p.y, p.m - 1, 1));
}

function addMonthsUTC(d: Date, delta: number) {
  const nd = new Date(d);
  nd.setUTCMonth(nd.getUTCMonth() + delta);
  return nd;
}

function ymdFromUTCDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthTitleChile(d: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "long",
  }).format(d);
}

function buildMonthGridUTC(monthStartUTC: Date) {
  const first = new Date(monthStartUTC);
  const dowSun0 = first.getUTCDay();
  const dowMon0 = (dowSun0 + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - dowMon0);

  const days: { ymd: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const ymd = ymdFromUTCDate(d);
    const inMonth = d.getUTCMonth() === monthStartUTC.getUTCMonth();
    days.push({ ymd, inMonth });
  }
  return days;
}

function toDateAndTime(isoStartsAt: string): { date: string; time: string } {
  // iso viene en UTC (Z), sacamos YYYY-MM-DD y HH:MM de ese ISO
  const d = new Date(isoStartsAt);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

export default function EmbedBookingPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const slug = params?.slug ?? "";
  const bookingKey = searchParams.get("key") ?? "";

  const initialDay = useMemo(() => todayChileYMD(), []);
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const [monthUTC, setMonthUTC] = useState<Date>(() => startOfMonthUTC(initialDay));
  const monthGrid = useMemo(() => buildMonthGridUTC(monthUTC), [monthUTC]);

  const [available, setAvailable] = useState<Slot[]>([]);
  const [taken, setTaken] = useState<TakenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // booking form
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pickedDayLabel = useMemo(() => fmtChileDateLabel(selectedDay), [selectedDay]);

  async function reload() {
    if (!slug) return;
    if (!bookingKey) {
      setMsg("Falta ?key=... en la URL");
      setAvailable([]);
      setTaken([]);
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const a = await fetch(
        `/api/v1/public/booking/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(
          selectedDay
        )}&key=${encodeURIComponent(bookingKey)}`,
        { method: "GET" }
      );
      const aj = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(aj?.error?.message ?? aj?.message ?? "No se pudo cargar disponibilidad");

      const t = await fetch(
        `/api/v1/public/booking/${encodeURIComponent(slug)}/taken?date=${encodeURIComponent(
          selectedDay
        )}&key=${encodeURIComponent(bookingKey)}`,
        { method: "GET" }
      );
      const tj = await t.json().catch(() => ({}));
      if (!t.ok) throw new Error(tj?.error?.message ?? tj?.message ?? "No se pudo cargar tomados");

      setAvailable(Array.isArray(aj.slots) ? aj.slots : []);
      setTaken(Array.isArray(tj.taken) ? tj.taken : []);
    } catch (e: any) {
      setMsg(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const p = parseYMD(selectedDay);
    if (!p) return;
    const monthStart = new Date(Date.UTC(p.y, p.m - 1, 1));
    if (monthStart.getTime() !== monthUTC.getTime()) setMonthUTC(monthStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedDay, bookingKey]);

  async function submitBooking() {
    setMsg("");
    if (!pickedSlot) {
      setMsg("Selecciona un horario disponible.");
      return;
    }
    if (!visitorName.trim()) {
      setMsg("Ingresa tu nombre.");
      return;
    }

    const { date, time } = toDateAndTime(pickedSlot.startsAt);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/public/booking/${encodeURIComponent(slug)}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingKey,
          date,
          time,
          visitorName: visitorName.trim(),
          visitorEmail: visitorEmail.trim(),
          visitorPhone: visitorPhone.trim(),
          notes: notes.trim(),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? "No se pudo agendar");

      setMsg("✅ Reserva creada. ¡Te esperamos!");
      setPickedSlot(null);
      setVisitorName("");
      setVisitorEmail("");
      setVisitorPhone("");
      setNotes("");

      await reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Error");
      // si alguien tomó el slot justo antes:
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        background: "#0b0f1a",
        color: "#e5e7eb",
        minHeight: "100vh",
        padding: 14,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Reserva tu visita</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Hora Chile</div>
        </div>

        {/* Calendar */}
        <div style={{ marginTop: 12, border: "1px solid #1f2937", borderRadius: 16, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button
              onClick={() => setMonthUTC((d) => addMonthsUTC(d, -1))}
              style={{
                background: "#111827",
                border: "1px solid #374151",
                color: "#e5e7eb",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              ◀
            </button>

            <div style={{ textTransform: "capitalize", fontWeight: 600 }}>{monthTitleChile(monthUTC)}</div>

            <button
              onClick={() => setMonthUTC((d) => addMonthsUTC(d, +1))}
              style={{
                background: "#111827",
                border: "1px solid #374151",
                color: "#e5e7eb",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              ▶
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
            {["L", "M", "M", "J", "V", "S", "D"].map((x, idx) => (
              <div key={`${x}-${idx}`} style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                {x}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {monthGrid.map((d) => {
              const isSelected = d.ymd === selectedDay;
              return (
                <button
                  key={d.ymd}
                  onClick={() => {
                    setSelectedDay(d.ymd);
                    setPickedSlot(null);
                  }}
                  style={{
                    padding: "10px 0",
                    borderRadius: 12,
                    border: isSelected ? "1px solid #60a5fa" : "1px solid #1f2937",
                    background: isSelected ? "#0b3b8a" : d.inMonth ? "#111827" : "#0b1220",
                    color: d.inMonth ? "#e5e7eb" : "#6b7280",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {d.ymd.slice(-2)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#9ca3af", fontSize: 12, textTransform: "capitalize" }}>
          {pickedDayLabel}
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: msg.startsWith("✅") ? "1px solid #14532d" : "1px solid #7f1d1d",
              background: msg.startsWith("✅") ? "#0b1f12" : "#1f0b0b",
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Available */}
          <div style={{ border: "1px solid #1f2937", borderRadius: 16, padding: 12, background: "#0b1220" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Disponibles</div>
            {loading ? <div style={{ color: "#9ca3af" }}>Cargando…</div> : null}
            {!loading && available.length === 0 ? <div style={{ color: "#9ca3af" }}>Sin slots.</div> : null}

            <div style={{ display: "grid", gap: 8 }}>
              {available.map((s) => {
                const active = pickedSlot?.startsAt === s.startsAt;
                return (
                  <button
                    key={s.startsAt}
                    onClick={() => setPickedSlot(s)}
                    style={{
                      textAlign: "left",
                      border: active ? "1px solid #60a5fa" : "1px solid #1f2937",
                      borderRadius: 12,
                      padding: "10px 10px",
                      background: active ? "#0b3b8a" : "#111827",
                      color: "#e5e7eb",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {fmtChileTime(s.startsAt)} – {fmtChileTime(s.endsAt)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Taken */}
          <div style={{ border: "1px solid #1f2937", borderRadius: 16, padding: 12, background: "#0b1220" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Tomados</div>
            {loading ? <div style={{ color: "#9ca3af" }}>Cargando…</div> : null}
            {!loading && taken.length === 0 ? <div style={{ color: "#9ca3af" }}>Sin citas.</div> : null}

            <div style={{ display: "grid", gap: 8 }}>
              {taken.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: "1px solid #7c2d12",
                    borderRadius: 12,
                    padding: "10px 10px",
                    background: "#1f130b",
                    fontSize: 13,
                    color: "#fdba74",
                  }}
                >
                  {fmtChileTime(s.startsAt)} – {fmtChileTime(s.endsAt)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <div style={{ marginTop: 12, border: "1px solid #1f2937", borderRadius: 16, padding: 12, background: "#0b1220" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Datos del visitante</div>

          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
            {pickedSlot ? (
              <>
                Slot seleccionado: <b>{fmtChileTime(pickedSlot.startsAt)}</b>
              </>
            ) : (
              <>Selecciona un horario disponible para continuar.</>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Nombre y apellido"
              style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2937", background: "#111827", color: "#e5e7eb" }}
            />
            <input
              value={visitorEmail}
              onChange={(e) => setVisitorEmail(e.target.value)}
              placeholder="Email (opcional)"
              style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2937", background: "#111827", color: "#e5e7eb" }}
            />
            <input
              value={visitorPhone}
              onChange={(e) => setVisitorPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
              style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2937", background: "#111827", color: "#e5e7eb" }}
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
              rows={3}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2937", background: "#111827", color: "#e5e7eb" }}
            />

            <button
              disabled={!pickedSlot || submitting}
              onClick={submitBooking}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #1f2937",
                background: !pickedSlot || submitting ? "#0b1220" : "#16a34a",
                color: !pickedSlot || submitting ? "#9ca3af" : "#052e16",
                fontWeight: 700,
                cursor: !pickedSlot || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Agendando..." : "Confirmar reserva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
