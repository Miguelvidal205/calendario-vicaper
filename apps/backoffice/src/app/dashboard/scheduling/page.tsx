"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, startOfDay, endOfDay, getHours } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

// --- 1. Configuración del Localizer ---
const locales = { "es": es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// --- 2. Tipos de Datos ---
type AppointmentDto = {
  id: string;
  terrenoId: string;
  assignedUserId: string;
  title?: string;
  notes?: string;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  startsAt: string;
  endsAt: string;
};

type MemberDto = {
  user_id: string;
  role: "admin" | "agent" | "installer";
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: AppointmentDto;
};

// --- 3. Helpers ---
class RequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new RequestError(data?.error?.code ?? "REQUEST_FAILED", data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

function handleNoActiveTerreno(e: unknown): boolean {
  const err = e as any;
  if (err?.name === "RequestError" && err.code === "NO_ACTIVE_TERRENO") {
    window.location.href = "/dashboard/terrenos";
    return true;
  }
  return false;
}

function pickDefaultAssignee(members: MemberDto[]): string {
  const agent = members.find((m) => m.role === "agent")?.user_id;
  if (agent) return agent;
  const admin = members.find((m) => m.role === "admin")?.user_id;
  return members[0]?.user_id ?? "";
}

// --- 4. Componente Principal ---
export default function SchedulingPage() {
  // Estado de Creación
  const todayLocal = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startsAtLocal, setStartsAtLocal] = useState<string>(() => `${todayLocal}T10:00`);
  const [endsAtLocal, setEndsAtLocal] = useState<string>("");
  const [title, setTitle] = useState<string>("Visita");
  
  // Estado Global
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  
  // Estado Calendario
  const [view, setView] = useState<View>(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  
  // Estado Modal
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDto | null>(null);

  // --- Efectos y Carga de Datos ---
  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      try {
        const data = await jsonFetch<{ members: MemberDto[] }>("/api/v1/terreno/members");
        if (cancelled) return;
        const list = data.members ?? [];
        setMembers(list);
        setAssignedUserId(prev => prev || pickDefaultAssignee(list));
      } catch (e) {
        if (!handleNoActiveTerreno(e)) setMsg("❌ Error cargando miembros");
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, []);

  const fetchAppointments = useCallback(async (date: Date, view: View, userId: string) => {
    if (!userId) return;
    setLoading(true);
    setMsg("");
    try {
      let from: Date, to: Date;
      if (view === Views.MONTH) {
        from = startOfMonth(date);
        to = endOfMonth(date);
        from = startOfWeek(from, { weekStartsOn: 1 }); 
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
    } catch (e) {
      if (!handleNoActiveTerreno(e)) {
         const err = e as any;
         setMsg(`❌ Error cargando agenda: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (assignedUserId) {
      fetchAppointments(currentDate, view, assignedUserId);
    }
  }, [currentDate, view, assignedUserId, fetchAppointments]);

  // --- Acciones de Negocio ---
  async function createAppointment() {
    setMsg("");
    if (!assignedUserId) return setMsg("⚠️ No hay usuario asignable.");
    const startsAt = new Date(startsAtLocal);
    if (Number.isNaN(startsAt.getTime())) return setMsg("⚠️ Fecha inválida.");

    let endsAt: Date | null = null;
    if (endsAtLocal.trim()) endsAt = new Date(endsAtLocal);

    setLoading(true);
    try {
      await jsonFetch("/api/v1/appointments", {
        method: "POST",
        body: JSON.stringify({
          assignedUserId,
          startsAt: startsAt.toISOString(),
          ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
          title
        }),
      });
      setMsg("✅ Cita creada.");
      fetchAppointments(currentDate, view, assignedUserId);
      setTitle("Visita");
    } catch (e) {
      if (!handleNoActiveTerreno(e)) setMsg("❌ Error creando cita");
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(appointment: AppointmentDto, status: "completed" | "no_show") {
    try {
      await jsonFetch(`/api/v1/appointments/${encodeURIComponent(appointment.id)}/attendance`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      const updated = { ...appointment, status };
      setAppointments(prev => prev.map(a => a.id === appointment.id ? updated : a));
      setSelectedAppointment(updated);
    } catch (e) {
      alert("Error actualizando estado.");
    }
  }

  // --- Configuración Visual del Calendario ---
  const { defaultScroll } = useMemo(() => {
  // Solo configuramos el scroll inicial a las 08:00
  // Así el usuario ve la mañana, pero puede scrollear hacia arriba si hay algo a las 06:00
  const scroll = new Date();
  scroll.setHours(8, 0, 0);
  
  return { defaultScroll: scroll };
}, []);

  const slotPropGetter = useCallback((date: Date) => {
    const hour = getHours(date);
    const day = getDay(date);
    const isWeekend = day === 0 || day === 6;
    const isWorkHour = hour >= 9 && hour < 18;
    if (isWeekend || !isWorkHour) {
      return { style: { backgroundColor: "#f9fafb", color: "#9ca3af" } };
    }
    return {};
  }, []);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    let backgroundColor = '#3b82f6'; 
    if (event.resource.status === 'completed') backgroundColor = '#10b981';
    if (event.resource.status === 'no_show') backgroundColor = '#ef4444'; 
    if (event.resource.status === 'cancelled') backgroundColor = '#6b7280'; 
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
      }
    };
  }, []);

  const events: CalendarEvent[] = useMemo(() => appointments.map(a => ({
    id: a.id,
    title: a.title || 'Cita',
    start: new Date(a.startsAt),
    end: new Date(a.endsAt),
    resource: a,
  })), [appointments]);

  const onSelectSlot = ({ start, end }: { start: Date, end: Date }) => {
    setStartsAtLocal(format(start, "yyyy-MM-dd'T'HH:mm"));
    setEndsAtLocal(format(end, "yyyy-MM-dd'T'HH:mm"));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- RENDER ---
  return (
    <div className="ui-page-container">
      <div className="ui-wrapper">
        
        {/* HEADER */}
        <div className="header-row">
          <h1 className="ui-title">Calendario</h1>
          <div className="ui-card user-select-card">
            <span className="ui-label-sm">Asignado:</span>
            <select 
              value={assignedUserId} 
              onChange={e => setAssignedUserId(e.target.value)}
              className="ui-select"
            >
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.role.toUpperCase()} ({m.user_id.slice(0,4)}...)</option>
              ))}
            </select>
          </div>
        </div>

        {msg && <div className={`ui-feedback ${msg.includes("✅") ? "success" : "error"}`}>{msg}</div>}

        {/* CREACIÓN RÁPIDA */}
        <div className="ui-card quick-form">
          <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ width: "4px", height: "20px", background: "#2563eb", borderRadius: "2px", marginRight: "10px" }}></div>
            <h3 className="ui-subtitle" style={{ margin: 0 }}>Agendar Nueva Cita</h3>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="ui-label">Inicio</label>
              <input type="datetime-local" value={startsAtLocal} onChange={e => setStartsAtLocal(e.target.value)} className="ui-input" />
            </div>
            <div className="form-group">
              <label className="ui-label">Fin (Opcional)</label>
              <input type="datetime-local" value={endsAtLocal} onChange={e => setEndsAtLocal(e.target.value)} className="ui-input" />
            </div>
            <div className="form-group grow">
              <label className="ui-label">Título</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="ui-input" />
            </div>
            <button onClick={createAppointment} disabled={loading} className="ui-btn ui-btn-primary self-end">
              {loading ? "..." : "Crear"}
            </button>
          </div>
        </div>

        {/* CALENDARIO */}
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
            onSelectEvent={(e) => setSelectedAppointment(e.resource)}
            onSelectSlot={onSelectSlot}
            selectable
            messages={{ next: "Sig", previous: "Ant", today: "Hoy", month: "Mes", week: "Semana", day: "Día", agenda: "Agenda", noEventsInRange: "Sin citas" }}
            culture="es"
          />
        </div>

        {/* MODAL DETALLE */}
        {selectedAppointment && (
          <div className="ui-modal-overlay" onClick={() => setSelectedAppointment(null)}>
            <div className="ui-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Detalle Cita</h3>
                <button className="close-btn" onClick={() => setSelectedAppointment(null)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="status-badge-row">
                  <span className={`status-badge ${selectedAppointment.status}`}>
                    {selectedAppointment.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Título:</strong> {selectedAppointment.title}
                </div>
                <div className="detail-row">
                   <strong>Fecha:</strong> {format(new Date(selectedAppointment.startsAt), "eeee d MMMM, HH:mm", { locale: es })}
                </div>
                {selectedAppointment.notes && (
                    <div className="notes-box">
                        <strong>Notas:</strong><br/>
                        {selectedAppointment.notes}
                    </div>
                )}
              </div>
              <div className="modal-footer">
                {selectedAppointment.status === 'scheduled' ? (
                  <>
                    <button onClick={() => markAttendance(selectedAppointment!, 'no_show')} className="ui-btn btn-danger">No Show</button>
                    <button onClick={() => markAttendance(selectedAppointment!, 'completed')} className="ui-btn btn-success">Completar</button>
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