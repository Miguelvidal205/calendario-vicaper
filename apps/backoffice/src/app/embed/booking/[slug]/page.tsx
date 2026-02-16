"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// --- TIPOS ---
type Slot = { startsAt: string; endsAt: string };
type TakenSlot = { id: string; startsAt: string; endsAt: string };

// --- HELPERS DE FECHAS (Timezone Chile) ---

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

  // 1. Calcular HOY para validaciones
  const initialDay = useMemo(() => todayChileYMD(), []);

  // Estado del Calendario
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [monthUTC, setMonthUTC] = useState<Date>(() =>
    startOfMonthUTC(initialDay),
  );
  const monthGrid = useMemo(() => buildMonthGridUTC(monthUTC), [monthUTC]);

  // VALIDACIÓN: ¿Podemos retroceder de mes?
  const actualCurrentMonthStart = useMemo(
    () => startOfMonthUTC(initialDay),
    [initialDay],
  );
  const canGoBack = monthUTC.getTime() > actualCurrentMonthStart.getTime();

  // --- ESTADO DE BRANDING ---
  const [config, setConfig] = useState({
    primaryColor: "#2563eb",
    backgroundColor: "#ffffff",
    logoUrl: "",
  });

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

  const pickedDayLabel = useMemo(
    () => fmtChileDateLabel(selectedDay),
    [selectedDay],
  );

  // Carga de disponibilidad y Configuración Visual
  async function reload() {
    if (!slug) return;
    if (!bookingKey) {
      setMsg("Error de configuración: Falta booking key");
      return;
    }
    setLoading(true);
    setMsg("");
    setPickedSlot(null);

    try {
      const [resConfig, resAvail, resTaken] = await Promise.all([
        fetch(`/api/v1/public/booking/${slug}/settings?key=${bookingKey}`),
        fetch(
          `/api/v1/public/booking/${slug}/availability?date=${selectedDay}&key=${bookingKey}`,
        ),
        fetch(
          `/api/v1/public/booking/${slug}/taken?date=${selectedDay}&key=${bookingKey}`,
        ),
      ]);

      const dataConfig = await resConfig.json();
      const dataAvail = await resAvail.json();
      const dataTaken = await resTaken.json();

      if (dataConfig.config) {
        setConfig({
          primaryColor: dataConfig.config.primaryColor || "#2563eb",
          backgroundColor: dataConfig.config.backgroundColor || "#ffffff",
          logoUrl: dataConfig.config.logoUrl || "",
        });
      }

      if (!resAvail.ok)
        throw new Error(dataAvail.message || "Error cargando horarios");
      if (!resTaken.ok)
        throw new Error(dataTaken.message || "Error cargando ocupados");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Cargar datos al iniciar o cambiar día
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedDay, bookingKey]);

  // Submit Reserva
  async function submitBooking() {
    setMsg("");
    if (!pickedSlot) return setMsg("Selecciona un horario disponible.");
    if (visitorName.trim().length < 3)
      return setMsg("Ingresa tu nombre completo.");
    if (!visitorEmail.includes("@")) return setMsg("Ingresa un email válido.");

    const timeCH = fmtChileTime(pickedSlot.startsAt);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/public/booking/${slug}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingKey,
          date: selectedDay,
          time: timeCH,
          visitorName: visitorName.trim(),
          visitorEmail: visitorEmail.trim(),
          visitorPhone: visitorPhone.trim(),
          notes: notes.trim(),
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        if (j.code === "CONFLICT_OVERLAP")
          throw new Error("¡Ups! Alguien acaba de tomar este horario.");
        if (j.code === "OUTSIDE_WORKING_HOURS")
          throw new Error("El horario ya no está disponible.");
        throw new Error(j.message || "No se pudo agendar.");
      }

      setSuccessId(j.appointmentId);
      setMsgType("success");
      setMsg("Reserva confirmada exitosamente.");
    } catch (e: any) {
      setMsgType("error");
      setMsg(e.message || "Error desconocido");
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  // --- VARIABLES CSS DINÁMICAS ---
  const brandingStyles = {
    "--primary": config.primaryColor,
    "--bg-page": config.backgroundColor,
    "--primary-soft": `${config.primaryColor}20`,
  } as React.CSSProperties;

  // --- RENDER SUCCESS ---
  if (successId) {
    return (
      <div
        style={{
          ...brandingStyles,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          background: "var(--bg-page)",
          color: "#1e293b",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: "#dcfce7",
            color: "#16a34a",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            fontSize: 32,
          }}
        >
          ✓
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          ¡Reserva Confirmada!
        </h2>
        <p style={{ color: "#475569", marginBottom: 24 }}>
          Te esperamos el <strong>{pickedDayLabel}</strong> a las{" "}
          <strong>
            {pickedSlot ? fmtChileTime(pickedSlot.startsAt) : ""} hrs
          </strong>
          .
        </p>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32 }}>
          Hemos enviado los detalles a {visitorEmail}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 24px",
            background: "var(--primary)",
            color: "white",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Agendar otra visita
        </button>
      </div>
    );
  }

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#1e293b",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  };

  return (
    <div
      style={{
        ...brandingStyles,
        fontFamily: "system-ui, sans-serif",
        background: "var(--bg-page)",
        color: "#1e293b",
        minHeight: "100vh",
        padding: "20px 14px",
      }}
    >
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo"
              style={{ maxHeight: 40, maxWidth: 200, objectFit: "contain" }}
            />
          ) : (
            <div
              style={{ color: "var(--primary)", fontWeight: 800, fontSize: 20 }}
            >
              PROYECTO
            </div>
          )}
          <div
            style={{
              fontSize: 12,
              background: "#f1f5f9",
              padding: "4px 8px",
              borderRadius: "12px",
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            Hora Chile
          </div>
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 20,
            padding: 20,
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <button
              onClick={() =>
                canGoBack && setMonthUTC((d) => addMonthsUTC(d, -1))
              }
              disabled={!canGoBack}
              style={{
                background: "none",
                border: "none",
                cursor: canGoBack ? "pointer" : "not-allowed",
                color: canGoBack ? "#475569" : "#cbd5e1",
                fontSize: 18,
              }}
            >
              ❮
            </button>
            <div
              style={{
                textTransform: "capitalize",
                fontWeight: 700,
                fontSize: 16,
                color: "#0f172a",
              }}
            >
              {monthTitleChile(monthUTC)}
            </div>
            <button
              onClick={() => setMonthUTC((d) => addMonthsUTC(d, +1))}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#475569",
                fontSize: 18,
              }}
            >
              ❯
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              marginBottom: 8,
            }}
          >
            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((x) => (
              <div
                key={x}
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                {x}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
            }}
          >
            {monthGrid.map((d) => {
              const isSelected = d.ymd === selectedDay;
              const isPast = d.ymd < initialDay;

              return (
                <button
                  key={d.ymd}
                  disabled={isPast}
                  onClick={() => {
                    if (!isPast) {
                      setSelectedDay(d.ymd);
                      setPickedSlot(null);
                    }
                  }}
                  style={{
                    padding: "10px 0",
                    borderRadius: "10px",
                    border: isSelected
                      ? "2px solid var(--primary)"
                      : "1px solid transparent",
                    background: isSelected
                      ? "var(--primary-soft)"
                      : "transparent",
                    color: isPast
                      ? "#e2e8f0"
                      : isSelected
                        ? "var(--primary)"
                        : d.inMonth
                          ? "#334155"
                          : "#cbd5e1",
                    cursor: isPast ? "default" : "pointer",
                    fontSize: 14,
                    fontWeight: isSelected ? 700 : 500,
                    textDecoration: isPast ? "line-through" : "none",
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                >
                  {d.ymd.slice(-2)}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            fontWeight: 700,
            fontSize: 15,
            color: "#0f172a",
            textTransform: "capitalize",
          }}
        >
          {pickedDayLabel}
        </div>

        {/* Slots */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* Disponibles */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 12,
                color: "#16a34a",
              }}
            >
              ● Disponibles
            </div>
            {loading ? (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Cargando...</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                  gap: 8,
                }}
              >
                {available.map((s) => {
                  const active = pickedSlot?.startsAt === s.startsAt;
                  return (
                    <button
                      key={s.startsAt}
                      onClick={() => setPickedSlot(s)}
                      style={{
                        textAlign: "center",
                        padding: "6px",
                        borderRadius: "6px",
                        border: active
                          ? "2px solid var(--primary)"
                          : "1px solid #cbd5e1",
                        background: active ? "var(--primary-soft)" : "#fff",
                        color: active ? "var(--primary)" : "#475569",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {fmtChileTime(s.startsAt)}
                    </button>
                  );
                })}
                {!loading && available.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      gridColumn: "1/-1",
                    }}
                  >
                    No hay cupos
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ocupados */}
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fee2e2",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 12,
                color: "#ef4444",
              }}
            >
              ● Ocupados
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                gap: 8,
              }}
            >
              {taken.map((s) => (
                <div
                  key={s.id}
                  style={{
                    textAlign: "center",
                    padding: "6px",
                    borderRadius: "6px",
                    background: "#fff",
                    border: "1px solid #fecaca",
                    fontSize: 12,
                    color: "#f87171",
                    textDecoration: "line-through",
                    opacity: 0.7,
                  }}
                >
                  {fmtChileTime(s.startsAt)}
                </div>
              ))}
              {!loading && taken.length === 0 && (
                <div
                  style={{ fontSize: 12, color: "#fca5a5", gridColumn: "1/-1" }}
                >
                  Nada por hoy
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div
          style={{
            marginTop: 24,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
            Tus datos
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Nombre completo"
              style={inputStyle}
              disabled={submitting}
            />
            <input
              type="email"
              value={visitorEmail}
              onChange={(e) => setVisitorEmail(e.target.value)}
              placeholder="Correo electrónico"
              style={inputStyle}
              disabled={submitting}
            />
            <input
              type="tel"
              value={visitorPhone}
              onChange={(e) => setVisitorPhone(e.target.value)}
              placeholder="Teléfono"
              style={inputStyle}
              disabled={submitting}
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              style={{ ...inputStyle, minHeight: 80, resize: "none" }}
              disabled={submitting}
            />

            {msg && msgType === "error" && (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "#fef2f2",
                  color: "#991b1b",
                }}
              >
                {msg}
              </div>
            )}

            <button
              disabled={!pickedSlot || submitting}
              onClick={submitBooking}
              style={{
                marginTop: 8,
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background:
                  !pickedSlot || submitting ? "#e2e8f0" : "var(--primary)",
                color: !pickedSlot || submitting ? "#94a3b8" : "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: !pickedSlot || submitting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {submitting && (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
              {submitting ? "Confirmando..." : "Confirmar Reserva"}
            </button>
          </div>
          <style jsx>{`
            @keyframes spin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
