"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// --- TIPOS ---
type Slot = { startsAt: string; endsAt: string };
type TakenSlot = { id: string; startsAt: string; endsAt: string };

// --- HELPERS DE FECHAS (Timezone Chile) ---

// Formatea HH:MM (Chile) para mostrar en la UI y enviar al backend
function fmtChileTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

// Formatea título del día seleccionado (Ej: Lunes 20 de Octubre)
function fmtChileDateLabel(yyyyMmDd: string) {
  // Truco: T12:00 evita problemas de rollovers de día al parsear
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

// Obtiene el día actual en Chile YYYY-MM-DD
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

// Parsers auxiliares para el calendario
function parseYMD(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
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
  const dowMon0 = (dowSun0 + 6) % 7; // Ajuste para empezar Lunes
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

// --- COMPONENTE PRINCIPAL ---

export default function EmbedBookingPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const slug = params?.slug ?? "";
  const bookingKey = searchParams.get("key") ?? "";

  // Estado del Calendario
  const initialDay = useMemo(() => todayChileYMD(), []);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [monthUTC, setMonthUTC] = useState<Date>(() => startOfMonthUTC(initialDay));
  const monthGrid = useMemo(() => buildMonthGridUTC(monthUTC), [monthUTC]);

  // Estado de Datos (Slots)
  const [available, setAvailable] = useState<Slot[]>([]);
  const [taken, setTaken] = useState<TakenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [msgType, setMsgType] = useState<"success" | "error">("error");

  // Estado del Formulario
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const pickedDayLabel = useMemo(() => fmtChileDateLabel(selectedDay), [selectedDay]);

  // Carga de disponibilidad
  async function reload() {
    if (!slug) return;
    if (!bookingKey) {
      setMsg("Error de configuración: Falta booking key");
      return;
    }
    setLoading(true);
    setMsg("");
    setPickedSlot(null); // Reset slot al cambiar día
    
    try {
      // Fetch Paralelo
      const [resAvail, resTaken] = await Promise.all([
        fetch(`/api/v1/public/booking/${slug}/availability?date=${selectedDay}&key=${bookingKey}`),
        fetch(`/api/v1/public/booking/${slug}/taken?date=${selectedDay}&key=${bookingKey}`)
      ]);

      const dataAvail = await resAvail.json();
      const dataTaken = await resTaken.json();

      if (!resAvail.ok) throw new Error(dataAvail.message || "Error cargando horarios");
      if (!resTaken.ok) throw new Error(dataTaken.message || "Error cargando ocupados");

      setAvailable(dataAvail.slots || []);
      setTaken(dataTaken.taken || []);
    } catch (e: any) {
      setMsgType("error");
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Sync del mes del calendario con el día seleccionado
  useEffect(() => {
    const p = parseYMD(selectedDay);
    if (!p) return;
    const monthStart = new Date(Date.UTC(p.y, p.m - 1, 1));
    if (monthStart.getTime() !== monthUTC.getTime()) setMonthUTC(monthStart);
  }, [selectedDay]);

  // Cargar datos al iniciar o cambiar día
  useEffect(() => {
    void reload();
  }, [slug, selectedDay, bookingKey]);

  // Submit Reserva
  async function submitBooking() {
    setMsg("");
    
    // Validaciones Frontend
    if (!pickedSlot) return setMsg("Selecciona un horario disponible.");
    if (visitorName.trim().length < 3) return setMsg("Ingresa tu nombre completo.");
    if (!visitorEmail.includes("@")) return setMsg("Ingresa un email válido.");
    
    // Extraer la hora "HH:MM" en zona horaria Chile desde el slot UTC
    // Importante: Usamos fmtChileTime para asegurar que enviamos lo que el usuario VE
    const timeCH = fmtChileTime(pickedSlot.startsAt); 

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/public/booking/${slug}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingKey,
          date: selectedDay, // YYYY-MM-DD
          time: timeCH,      // HH:MM (Chile)
          visitorName: visitorName.trim(),
          visitorEmail: visitorEmail.trim(),
          visitorPhone: visitorPhone.trim(),
          notes: notes.trim(),
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        if (j.code === "CONFLICT_OVERLAP") throw new Error("¡Ups! Alguien acaba de tomar este horario.");
        if (j.code === "OUTSIDE_WORKING_HOURS") throw new Error("El horario ya no está disponible.");
        throw new Error(j.message || "No se pudo agendar.");
      }

      // Éxito
      setSuccessId(j.appointmentId);
      setMsgType("success");
      setMsg("Reserva confirmada exitosamente.");

    } catch (e: any) {
      setMsgType("error");
      setMsg(e.message || "Error desconocido");
      await reload(); // Refrescar para mostrar que se ocupó
    } finally {
      setSubmitting(false);
    }
  }

  // --- RENDER SUCCESS ---
  if (successId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Reserva Confirmada!</h2>
        <p className="text-slate-600 mb-6">
          Te esperamos el <strong>{pickedDayLabel}</strong> a las <strong>{pickedSlot ? fmtChileTime(pickedSlot.startsAt) : ""} hrs</strong>.
        </p>
        <p className="text-sm text-slate-400 mb-8">Hemos enviado los detalles a {visitorEmail}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Agendar otra visita
        </button>
      </div>
    );
  }

  // --- RENDER FORM ---
  const inputStyle = {
    padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0",
    background: "#fff", color: "#1e293b", fontSize: "14px", width: "100%",
    boxSizing: "border-box" as const, outline: "none"
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#1e293b", minHeight: "100vh", padding: "20px 14px" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ color: "#2563eb", fontWeight: 800, fontSize: 20 }}>VICAPER</div>
          <div style={{ fontSize: 12, background: "#f1f5f9", padding: "4px 8px", borderRadius: "12px", color: "#64748b", fontWeight: 600 }}>Hora Chile</div>
        </div>

        {/* Calendar Grid */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={() => setMonthUTC((d) => addMonthsUTC(d, -1))} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", color: "#475569" }}> ❮ </button>
            <div style={{ textTransform: "capitalize", fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{monthTitleChile(monthUTC)}</div>
            <button onClick={() => setMonthUTC((d) => addMonthsUTC(d, +1))} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", color: "#475569" }}> ❯ </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((x) => (
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
                    padding: "10px 0", borderRadius: "10px",
                    border: isSelected ? "2px solid #2563eb" : "1px solid transparent",
                    background: isSelected ? "#eff6ff" : "transparent",
                    color: isSelected ? "#1d4ed8" : (d.inMonth ? "#334155" : "#cbd5e1"),
                    cursor: "pointer", fontSize: 14, fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {d.ymd.slice(-2)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 24, fontWeight: 700, fontSize: 15, color: "#0f172a", textTransform: "capitalize" }}>{pickedDayLabel}</div>

        {/* Slots */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Disponibles */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#16a34a" }}>● Disponibles</div>
            {loading ? <div style={{ fontSize: 12, color: "#94a3b8" }}>Cargando...</div> : (
               <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
                 {available.map((s) => {
                   const active = pickedSlot?.startsAt === s.startsAt;
                   return (
                     <button
                       key={s.startsAt}
                       onClick={() => setPickedSlot(s)}
                       style={{
                         textAlign: "center", padding: "6px", borderRadius: "6px",
                         border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                         background: active ? "#eff6ff" : "#fff",
                         color: active ? "#1d4ed8" : "#475569",
                         fontSize: 12, fontWeight: 600, cursor: "pointer"
                       }}
                     >
                       {fmtChileTime(s.startsAt)}
                     </button>
                   );
                 })}
                 {!loading && available.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", gridColumn: "1/-1" }}>No hay cupos</div>}
               </div>
            )}
          </div>

          {/* Ocupados */}
          <div style={{ background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#ef4444" }}>● Ocupados</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
              {taken.map((s) => (
                <div key={s.id} style={{ textAlign: "center", padding: "6px", borderRadius: "6px", background: "#fff", border: "1px solid #fecaca", fontSize: 12, color: "#f87171", textDecoration: "line-through", opacity: 0.7 }}>
                  {fmtChileTime(s.startsAt)}
                </div>
              ))}
              {!loading && taken.length === 0 && <div style={{ fontSize: 12, color: "#fca5a5", gridColumn: "1/-1" }}>Nada por hoy</div>}
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div style={{ marginTop: 24, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Tus datos</div>
          
          <div style={{ display: "grid", gap: 12 }}>
            <input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Nombre completo" style={inputStyle} disabled={submitting} />
            <input type="email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="Correo electrónico" style={inputStyle} disabled={submitting} />
            <input type="tel" value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} placeholder="Teléfono" style={inputStyle} disabled={submitting} />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales..." style={{...inputStyle, minHeight: 80, resize: "none"}} disabled={submitting} />

            {/* Mensajes de Error */}
            {msg && msgType === 'error' && (
              <div style={{ padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, background: "#fef2f2", color: "#991b1b" }}>
                {msg}
              </div>
            )}

            <button
              disabled={!pickedSlot || submitting}
              onClick={submitBooking}
              style={{
                marginTop: 8, padding: "14px", borderRadius: "12px", border: "none",
                background: !pickedSlot || submitting ? "#e2e8f0" : "#2563eb",
                color: !pickedSlot || submitting ? "#94a3b8" : "#fff",
                fontWeight: 700, fontSize: 15, cursor: (!pickedSlot || submitting) ? "not-allowed" : "pointer", 
                transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              {submitting && <div style={{width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite"}} />}
              {submitting ? "Confirmando..." : "Confirmar Reserva"}
            </button>
          </div>
          <style jsx>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </div>

      </div>
    </div>
  );
}