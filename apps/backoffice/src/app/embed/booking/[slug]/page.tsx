"use client";

import { useEffect, useMemo, useState } from "react";

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
  // Date.UTC requiere números no-undefined -> ya garantizado
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
  // grid 6x7 (lunes a domingo)
  const first = new Date(monthStartUTC);
  const dowSun0 = first.getUTCDay(); // 0..6 (Sun..Sat)
  const dowMon0 = (dowSun0 + 6) % 7; // 0..6 (Mon..Sun)
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

type PageProps = {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function EmbedBookingPage({ params, searchParams }: PageProps) {
  const slug = params.slug;
  const keyParam = searchParams?.key;
  const bookingKey = (Array.isArray(keyParam) ? keyParam[0] : keyParam) ?? "";

  const initialDay = useMemo(() => todayChileYMD(), []);
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const [monthUTC, setMonthUTC] = useState<Date>(() => startOfMonthUTC(initialDay));
  const monthGrid = useMemo(() => buildMonthGridUTC(monthUTC), [monthUTC]);

  const [available, setAvailable] = useState<Slot[]>([]);
  const [taken, setTaken] = useState<TakenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const pickedDayLabel = useMemo(() => fmtChileDateLabel(selectedDay), [selectedDay]);

  useEffect(() => {
    // si el usuario cambia selectedDay a otro mes, mantenemos el calendario alineado
    const p = parseYMD(selectedDay);
    if (!p) return;
    const monthStart = new Date(Date.UTC(p.y, p.m - 1, 1));
    if (monthStart.getTime() !== monthUTC.getTime()) setMonthUTC(monthStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!bookingKey) {
        setMsg("Falta ?key=... en la URL");
        return;
      }

      setLoading(true);
      setMsg("");

      try {
        // Disponibles
        const a = await fetch(
          `/api/v1/public/booking/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(selectedDay)}`,
          { method: "GET" }
        );
        const aj = await a.json().catch(() => ({}));
        if (!a.ok) throw new Error(aj?.error?.message ?? aj?.message ?? "No se pudo cargar disponibilidad");

        // Tomados
        const t = await fetch(
          `/api/v1/public/booking/${encodeURIComponent(slug)}/taken?date=${encodeURIComponent(
            selectedDay
          )}&key=${encodeURIComponent(bookingKey)}`,
          { method: "GET" }
        );
        const tj = await t.json().catch(() => ({}));
        if (!t.ok) throw new Error(tj?.error?.message ?? tj?.message ?? "No se pudo cargar tomados");

        if (cancelled) return;

        setAvailable(Array.isArray(aj.slots) ? aj.slots : []);
        setTaken(Array.isArray(tj.taken) ? tj.taken : []);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, selectedDay, bookingKey]);

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
                  onClick={() => setSelectedDay(d.ymd)}
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

        {/* Day info */}
        <div style={{ marginTop: 12, color: "#9ca3af", fontSize: 12, textTransform: "capitalize" }}>
          {pickedDayLabel}
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #7f1d1d",
              background: "#1f0b0b",
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
              {available.map((s) => (
                <div
                  key={s.startsAt}
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: 12,
                    padding: "10px 10px",
                    background: "#111827",
                    fontSize: 13,
                  }}
                >
                  {fmtChileTime(s.startsAt)} – {fmtChileTime(s.endsAt)}
                </div>
              ))}
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

        <div style={{ marginTop: 12, fontSize: 11, color: "#6b7280" }}>
          * Próximo paso: hacer clic en un slot disponible → formulario → confirmar reserva.
        </div>
      </div>
    </div>
  );
}
