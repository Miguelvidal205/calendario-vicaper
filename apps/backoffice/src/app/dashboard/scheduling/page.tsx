"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  endOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  getHours,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { es: es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type AppointmentDto = {
  id: string;
  terrenoId: string;
  assignedUserId: string;
  title?: string;
  notes?: string;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  startsAt: string;
  endsAt: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
};

type MemberDto = { user_id: string; role: string; color?: string };

async function jsonFetch<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok)
    throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

// --- Paleta de Colores para Agentes ---
const AGENT_COLORS = [
  "#3b82f6", // Azul (Default)
  "#8b5cf6", // Morado
  "#f59e0b", // Ámbar
  "#06b6d4", // Cyan
  "#ec4899", // Rosa
  "#14b8a6", // Turquesa
  "#f43f5e", // Rojo Suave
  "#84cc16", // Lima
];

function getAgentColor(userId: string) {
  if (!userId) return AGENT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

export default function SchedulingPage() {
  const todayLocal = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // --- Estados del Formulario de Creación ---
  const [startsAtLocal, setStartsAtLocal] = useState<string>(
    () => `${todayLocal}T10:00`,
  );
  const [endsAtLocal, setEndsAtLocal] = useState<string>("");
  const [title, setTitle] = useState<string>("Visita");
  const [formAssignee, setFormAssignee] = useState<string>("");

  // NUEVOS CAMPOS DEL CLIENTE
  const [visitorName, setVisitorName] = useState<string>("");
  const [visitorPhone, setVisitorPhone] = useState<string>("");
  const [visitorEmail, setVisitorEmail] = useState<string>("");

  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const [view, setView] = useState<View>(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [membersRes, usersRes] = await Promise.all([
          jsonFetch<{ members: MemberDto[]; currentUserId: string }>(
            "/api/v1/terreno/members",
          ),
          jsonFetch<{ users: { id: string; name: string }[] }>(
            "/api/v1/terreno/users",
          ).catch(() => ({ users: [] })),
        ]);

        if (cancelled) return;

        const map: Record<string, string> = {};
        usersRes.users.forEach((u) => (map[u.id] = u.name));
        setUsersMap(map);

        const list = membersRes.members ?? [];
        setMembers(list);

        const myId = membersRes.currentUserId;
        const me = list.find((m) => m.user_id === myId);
        const myRole = me?.role || "";
        setCurrentUserRole(myRole);

        if (myRole === "agent" && myId) {
          setAssignedUserId(myId);
        } else {
          setAssignedUserId("all");
        }
      } catch (e) {
        setMsg("❌ Error cargando datos iniciales");
      }
    }
    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFormAssignee(assignedUserId !== "all" ? assignedUserId : "");
  }, [assignedUserId]);

  const fetchAppointments = useCallback(
    async (date: Date, view: View, userId: string) => {
      if (!userId) return;
      setLoading(true);
      setMsg("");
      try {
        let from: Date, to: Date;
        if (view === Views.MONTH) {
          from = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
          // 👇 ESTA ERA LA LÍNEA QUE FALTABA 👇
          to = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
        } else if (view === Views.WEEK) {
          from = startOfWeek(date, { weekStartsOn: 1 });
          const endWeek = new Date(from);
          endWeek.setDate(endWeek.getDate() + 7);
          to = endWeek;
        } else {
          from = startOfDay(date);
          to = endOfDay(date);
        }

        const url = `/api/v1/availability?assignedUserId=${encodeURIComponent(userId)}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
        const data = await jsonFetch<{ appointments: AppointmentDto[] }>(url);
        setAppointments(data.appointments);
      } catch (e: any) {
        setMsg(`❌ Error cargando agenda: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (assignedUserId) fetchAppointments(currentDate, view, assignedUserId);
  }, [currentDate, view, assignedUserId, fetchAppointments]);

  async function createAppointment() {
    setMsg("");
    const targetUserId =
      assignedUserId === "all" ? formAssignee : assignedUserId;
    if (!targetUserId) return setMsg("⚠️ Selecciona un agente.");

    const startsAt = new Date(startsAtLocal);
    if (Number.isNaN(startsAt.getTime())) return setMsg("⚠️ Fecha inválida.");

    // NUEVA LÓGICA: Si no hay "Fin", le sumamos 1 hora automáticamente al "Inicio"
    let endsAt: Date;
    if (endsAtLocal.trim()) {
      endsAt = new Date(endsAtLocal);
    } else {
      endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000); // +1 hora en milisegundos
    }

    setLoading(true);
    try {
      await jsonFetch("/api/v1/appointments", {
        method: "POST",
        body: JSON.stringify({
          assignedUserId: targetUserId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(), // Ahora siempre enviamos una hora de fin
          title,
          visitorName,
          visitorPhone,
          visitorEmail,
        }),
      });
      setMsg("✅ Cita creada.");
      fetchAppointments(currentDate, view, assignedUserId);

      // Limpiamos el formulario
      setTitle("Visita");
      setVisitorName("");
      setVisitorPhone("");
      setVisitorEmail("");
      if (assignedUserId === "all") setFormAssignee("");
    } catch (e: any) {
      // Manejo del error específico de superposición para que sea legible por humanos
      if (
        e.message.includes("CONFLICT_OVERLAP") ||
        e.message.includes("overlaps")
      ) {
        setMsg(
          "❌ Error: Este agente ya tiene una cita en ese horario. Por favor elige otra hora.",
        );
      } else {
        setMsg(`❌ Error creando cita: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(
    appointment: AppointmentDto,
    status: "completed" | "no_show",
  ) {
    try {
      await jsonFetch(
        `/api/v1/appointments/${encodeURIComponent(appointment.id)}/attendance`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
        },
      );
      const updated = { ...appointment, status };
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointment.id ? updated : a)),
      );
      setSelectedAppointment(updated);
    } catch (e) {
      alert("Error actualizando estado.");
    }
  }

  const { defaultScroll } = useMemo(
    () => ({ defaultScroll: new Date(new Date().setHours(8, 0, 0)) }),
    [],
  );

  const slotPropGetter = useCallback((date: Date) => {
    const hour = getHours(date);
    const day = getDay(date);
    if (day === 0 || day === 6 || hour < 9 || hour >= 18) {
      return { style: { backgroundColor: "#f9fafb", color: "#9ca3af" } };
    }
    return {};
  }, []);

  const eventStyleGetter = useCallback(
    (event: any) => {
      // 1. Buscamos el color asignado a este ejecutivo
      const agent = members.find(
        (m) => m.user_id === event.resource.assignedUserId,
      );
      let bg = agent?.color || "#3b82f6"; // Color del agente o azul por defecto

      // 2. Si la cita cambió de estado, sobreescribimos el color
      if (event.resource.status === "completed") bg = "#10b981"; // Verde
      if (event.resource.status === "no_show") bg = "#ef4444"; // Rojo
      if (event.resource.status === "cancelled") bg = "#6b7280"; // Gris

      return {
        style: {
          backgroundColor: bg,
          borderRadius: "6px",
          border: "none",
          color: "white",
          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
          marginRight: "2px", // Pequeño margen para cuando hay citas a la misma hora
        },
      };
    },
    [members],
  );

  const EventComponent = ({ event }: any) => {
    const agentName = usersMap[event.resource.assignedUserId] || "Agente";
    const clientName =
      event.resource.visitorName ||
      event.resource.title ||
      "Cliente sin nombre";

    return (
      <div
        style={{
          padding: "2px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <strong
          style={{
            fontSize: "11px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          👤 {clientName}
        </strong>
        {assignedUserId === "all" && (
          <span
            style={{
              fontSize: "10px",
              opacity: 0.9,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            👔 {agentName}
          </span>
        )}
      </div>
    );
  };

  const events = useMemo(
    () =>
      appointments.map((a) => ({
        id: a.id,
        title: a.title || "Cita",
        start: new Date(a.startsAt),
        end: new Date(a.endsAt),
        resource: a,
      })),
    [appointments],
  );

  return (
    <div className="ui-page-container">
      <div className="ui-wrapper">
        <div className="header-row">
          <h1 className="ui-title">Calendario</h1>
          <div className="ui-card user-select-card">
            <span className="ui-label-sm">Ver agenda de:</span>
            {currentUserRole === "agent" ? (
              <span style={{ fontWeight: 600, fontSize: 14 }}>Mi Agenda</span>
            ) : (
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="ui-select"
                style={{ fontWeight: 600 }}
              >
                <option value="all">🌟 TODOS LOS AGENTES</option>
                {members.map((m) => (
                  <option
                    key={m.user_id}
                    value={m.user_id}
                    style={{ fontWeight: "normal" }}
                  >
                    {usersMap[m.user_id]
                      ? `${usersMap[m.user_id]} (${m.role})`
                      : m.role}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {msg && (
          <div
            className={`ui-feedback ${msg.includes("✅") ? "success" : "error"}`}
          >
            {msg}
          </div>
        )}

        {currentUserRole !== "agent" && (
          <div className="ui-card quick-form">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "16px",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: "4px",
                    height: "20px",
                    background: "#2563eb",
                    borderRadius: "2px",
                    marginRight: "10px",
                  }}
                ></div>
                <h3 className="ui-subtitle" style={{ margin: 0 }}>
                  Agendar Nueva Cita Manual
                </h3>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* FILA 1: Datos Operativos */}
              <div className="form-row">
                {assignedUserId === "all" && (
                  <div className="form-group grow">
                    <label className="ui-label">Asignar a</label>
                    <select
                      className="ui-select"
                      value={formAssignee}
                      onChange={(e) => setFormAssignee(e.target.value)}
                    >
                      <option value="">-- Seleccione un agente --</option>
                      {members
                        .filter((m) => m.role !== "admin")
                        .map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {usersMap[m.user_id] || m.role}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="ui-label">Inicio</label>
                  <input
                    type="datetime-local"
                    value={startsAtLocal}
                    onChange={(e) => setStartsAtLocal(e.target.value)}
                    className="ui-input"
                  />
                </div>
                <div className="form-group grow">
                  <label className="ui-label">Título de la Cita</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="ui-input"
                    placeholder="Ej: Visita Terreno A"
                  />
                </div>
              </div>

              {/* FILA 2: Datos del Cliente */}
              <div
                className="form-row"
                style={{
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div className="form-group grow">
                  <label className="ui-label">Nombre del Cliente</label>
                  <input
                    type="text"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="ui-input"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div className="form-group grow">
                  <label className="ui-label">Teléfono</label>
                  <input
                    type="text"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    className="ui-input"
                    placeholder="Ej: +569..."
                  />
                </div>
                <div className="form-group grow">
                  <label className="ui-label">Correo (Opcional)</label>
                  <input
                    type="email"
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    className="ui-input"
                    placeholder="Ej: juan@correo.com"
                  />
                </div>
              </div>

              <button
                onClick={createAppointment}
                disabled={loading}
                className="ui-btn ui-btn-primary self-end"
                style={{ marginTop: 4 }}
              >
                {loading ? "Guardando..." : "Crear Cita"}
              </button>
            </div>
          </div>
        )}

        <div className="ui-card calendar-container">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            scrollToTime={defaultScroll}
            slotPropGetter={slotPropGetter}
            eventPropGetter={eventStyleGetter}
            components={{ event: EventComponent }}
            onSelectEvent={(e) => setSelectedAppointment(e.resource)}
            onSelectSlot={({ start, end }) => {
              setStartsAtLocal(format(start, "yyyy-MM-dd'T'HH:mm"));
              setEndsAtLocal(format(end, "yyyy-MM-dd'T'HH:mm"));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            selectable={currentUserRole !== "agent"}
            messages={{
              next: "Sig",
              previous: "Ant",
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              agenda: "Agenda",
              noEventsInRange: "Sin citas",
            }}
            culture="es"
          />
        </div>

        {selectedAppointment && (
          <div
            className="ui-modal-overlay"
            onClick={() => setSelectedAppointment(null)}
          >
            <div
              className="ui-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Detalle de la Visita</h3>
                <button
                  className="close-btn"
                  onClick={() => setSelectedAppointment(null)}
                >
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="status-badge-row" style={{ marginBottom: 16 }}>
                  <span
                    className={`status-badge ${selectedAppointment.status}`}
                  >
                    {selectedAppointment.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    marginBottom: 16,
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      color: "#475569",
                      fontSize: 13,
                    }}
                  >
                    👨‍💼 Agente Asignado
                  </h4>
                  <div style={{ fontWeight: 600 }}>
                    {usersMap[selectedAppointment.assignedUserId] || "Agente"}
                  </div>
                </div>

                <div
                  style={{
                    background: "#f0fdf4",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #bbf7d0",
                    marginBottom: 16,
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      color: "#166534",
                      fontSize: 13,
                    }}
                  >
                    👤 Datos del Cliente
                  </h4>
                  <div className="detail-row">
                    <strong>Nombre:</strong>{" "}
                    {selectedAppointment.visitorName ||
                      selectedAppointment.title ||
                      "No registrado"}
                  </div>
                  <div className="detail-row">
                    <strong>Teléfono:</strong>{" "}
                    {selectedAppointment.visitorPhone || "No registrado"}
                  </div>
                  <div className="detail-row">
                    <strong>Email:</strong>{" "}
                    {selectedAppointment.visitorEmail || "No registrado"}
                  </div>
                </div>

                <div className="detail-row">
                  <strong>🗓️ Fecha y Hora:</strong> <br />
                  {format(
                    new Date(selectedAppointment.startsAt),
                    "eeee d MMMM, HH:mm",
                    { locale: es },
                  )}
                </div>

                {selectedAppointment.notes && (
                  <div className="notes-box" style={{ marginTop: 12 }}>
                    <strong>📝 Notas:</strong>
                    <br />
                    {selectedAppointment.notes}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {selectedAppointment.status === "scheduled" ? (
                  <>
                    <button
                      onClick={() =>
                        markAttendance(selectedAppointment!, "no_show")
                      }
                      className="ui-btn btn-danger"
                    >
                      No Show
                    </button>
                    <button
                      onClick={() =>
                        markAttendance(selectedAppointment!, "completed")
                      }
                      className="ui-btn btn-success"
                    >
                      Completar
                    </button>
                  </>
                ) : (
                  <span className="text-muted">Cita finalizada</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
