"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// ... (Mismas funciones auxiliares: fmtChileTime, fmtChileDateLabel, todayChileYMD, etc. - SE MANTIENEN IGUAL)
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
        `/api/v1/public/booking/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(selectedDay)}&key=${encodeURIComponent(bookingKey)}`,
        { method: "GET" }
      );
      const aj = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(aj?.error?.message ?? aj?.message ?? "No se pudo cargar disponibilidad");

      const t = await fetch(
        `/api/v1/public/booking/${encodeURIComponent(slug)}/taken?date=${encodeURIComponent(selectedDay)}&key=${encodeURIComponent(bookingKey)}`,
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
  }, [selectedDay]);

  useEffect(() => {
    void reload();
  }, [slug, selectedDay, bookingKey]);

  async function submitBooking() {
    setMsg("");
    if (!pickedSlot) { setMsg("Selecciona un horario disponible."); return; }
    if (!visitorName.trim()) { setMsg("Ingresa tu nombre."); return; }
    const { date, time } = toDateAndTime(pickedSlot.startsAt);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/public/booking/${encodeURIComponent(slug)}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingKey, date, time,
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
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#1e293b",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box" as const
  };

  return (
    <div style={{ 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      background: "#ffffff", 
      color: "#1e293b", 
      minHeight: "100vh", 
      padding: "20px 14px" 
    }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {/* Header con Logo Placeholder */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ color: "#2563eb", fontWeight: 800, fontSize: 20 }}>EMPRESA</div>
          <div style={{ fontSize: 12, background: "#f1f5f9", padding: "4px 8px", borderRadius: "12px", color: "#64748b", fontWeight: 600 }}>Hora Chile</div>
        </div>

        {/* Calendar Card */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={() => setMonthUTC((d) => addMonthsUTC(d, -1))} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "10px", cursor: "pointer" }}> ❮ </button>
            <div style={{ textTransform: "capitalize", fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{monthTitleChile(monthUTC)}</div>
            <button onClick={() => setMonthUTC((d) => addMonthsUTC(d, +1))} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "10px", cursor: "pointer" }}> ❯ </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x) => (
              <div key={x} style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", fontWeight: 600 }}>{x}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {monthGrid.map((d) => {
              const isSelected = d.ymd === selectedDay;
              return (
                <button
                  key={d.ymd}
                  onClick={() => { setSelectedDay(d.ymd); setPickedSlot(null); }}
                  style={{
                    padding: "10px 0",
                    borderRadius: "10px",
                    border: isSelected ? "2px solid #2563eb" : "1px solid transparent",
                    background: isSelected ? "#eff6ff" : "transparent",
                    color: isSelected ? "#1d4ed8" : (d.inMonth ? "#334155" : "#cbd5e1"),
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: isSelected ? 700 : 500,
                    transition: "all 0.1s"
                  }}
                >
                  {d.ymd.slice(-2)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14, color: "#0f172a", textTransform: "capitalize" }}>{pickedDayLabel}</div>

        {/* Slots Cards */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#16a34a" }}>● Disponibles</div>
            {loading ? <div style={{ fontSize: 12, color: "#94a3b8" }}>Cargando...</div> : (
               <div style={{ display: "grid", gap: 8 }}>
                 {available.map((s) => {
                   const active = pickedSlot?.startsAt === s.startsAt;
                   return (
                     <button
                       key={s.startsAt}
                       onClick={() => setPickedSlot(s)}
                       style={{
                         textAlign: "center",
                         border: active ? "2px solid #2563eb" : "1px solid #e2e8f0",
                         borderRadius: "8px",
                         padding: "8px",
                         background: active ? "#eff6ff" : "#fff",
                         color: active ? "#1d4ed8" : "#475569",
                         fontSize: 12,
                         fontWeight: 600,
                         cursor: "pointer"
                       }}
                     >
                       {fmtChileTime(s.startsAt)}
                     </button>
                   );
                 })}
                 {!loading && available.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>No hay cupos</div>}
               </div>
            )}
          </div>

          <div style={{ background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#dc2626" }}>● Ocupados</div>
            <div style={{ display: "grid", gap: 8 }}>
              {taken.map((s) => (
                <div key={s.id} style={{ textAlign: "center", padding: "8px", borderRadius: "8px", background: "#fff", border: "1px solid #fee2e2", fontSize: 12, color: "#f87171", textDecoration: "line-through" }}>
                  {fmtChileTime(s.startsAt)}
                </div>
              ))}
              {!loading && taken.length === 0 && <div style={{ fontSize: 12, color: "#fca5a5" }}>Sin reservas</div>}
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div style={{ marginTop: 24, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Datos del contacto</div>
          <div style={{ display: "grid", gap: 12 }}>
            <input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Nombre y apellido" style={inputStyle} />
            <input value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="Email" style={inputStyle} />
            <input value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} placeholder="Teléfono" style={inputStyle} />
            
            {msg && (
              <div style={{ 
                padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
                background: msg.includes("✅") ? "#f0fdf4" : "#fef2f2",
                color: msg.includes("✅") ? "#166534" : "#991b1b"
              }}> {msg} </div>
            )}

            <button
              disabled={!pickedSlot || submitting}
              onClick={submitBooking}
              style={{
                marginTop: 8, padding: "14px", borderRadius: "12px", border: "none",
                background: !pickedSlot || submitting ? "#e2e8f0" : "#16a34a",
                color: !pickedSlot || submitting ? "#94a3b8" : "#fff",
                fontWeight: 700, fontSize: 15, cursor: "pointer", transition: "all 0.2s"
              }}
            >
              {submitting ? "Procesando..." : "Confirmar Cita"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}