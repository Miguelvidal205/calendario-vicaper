"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css"; 

// --- Configuración del Localizer (date-fns) ---
const locales = {
  "es": es,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// --- Tipos existentes ---
type AppointmentDto = {
  id: string;
  terrenoId: string;
  assignedUserId: string;
  leadId?: string;
  title?: string;
  notes?: string;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
};

type MemberDto = {
  user_id: string;
  role: "admin" | "agent" | "installer";
};

// Evento mapeado para el calendario
type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: AppointmentDto; 
};

class RequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    const code = data?.error?.code ?? "REQUEST_FAILED";
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new RequestError(code, message);
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
  if (admin) return admin;
  const installer = members.find((m) => m.role === "installer")?.user_id;
  if (installer) return installer;
  return members[0]?.user_id ?? "";
}

export default function SchedulingPage() {
  // Estado para creación rápida
  const todayLocal = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startsAtLocal, setStartsAtLocal] = useState<string>(() => `${todayLocal}T10:00`);
  const [endsAtLocal, setEndsAtLocal] = useState<string>("");
  const [title, setTitle] = useState<string>("Visita");
  const [notes, setNotes] = useState<string>("");

  // Estado global
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Miembros
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [membersLoading, setMembersLoading] = useState(false);

  // --- ESTADO DEL CALENDARIO ---
  const [view, setView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);

  // Cargar miembros al inicio
  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      setMembersLoading(true);
      try {
        const data = await jsonFetch<{ members: MemberDto[] }>("/api/v1/terreno/members");
        if (cancelled) return;
        const list = data.members ?? [];
        setMembers(list);
        const picked = pickDefaultAssignee(list);
        setAssignedUserId((prev) => prev || picked);
      } catch (e) {
        if (handleNoActiveTerreno(e)) return;
        setMsg(`❌ Error cargando miembros`);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, []);

  // --- LÓGICA DE CARGA DE CITAS ---
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

  // Recargar cuando cambia la fecha, vista o usuario asignado
  useEffect(() => {
    if (assignedUserId) {
      fetchAppointments(currentDate, view, assignedUserId);
    }
  }, [currentDate, view, assignedUserId, fetchAppointments]);


  // --- ACCIONES ---
  async function createAppointment() {
    setMsg("");
    const assignee = assignedUserId || pickDefaultAssignee(members);
    if (!assignee) return setMsg("⚠️ No hay usuario asignable.");

    const startsAt = new Date(startsAtLocal);
    if (Number.isNaN(startsAt.getTime())) return setMsg("⚠️ startsAt inválido.");

    let endsAt: Date | null = null;
    if (endsAtLocal.trim()) {
       endsAt = new Date(endsAtLocal);
    }

    setLoading(true);
    try {
      const body: any = {
        assignedUserId: assignee,
        startsAt: startsAt.toISOString(),
        ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
        ...(title ? { title } : {}),
        ...(notes ? { notes } : {}),
      };

      await jsonFetch("/api/v1/appointments", { method: "POST", body: JSON.stringify(body) });
      setMsg("✅ Cita creada.");
      fetchAppointments(currentDate, view, assignee);
    } catch (e) {
      if (!handleNoActiveTerreno(e)) {
         setMsg(`❌ Error creando cita`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(appointment: AppointmentDto, status: "completed" | "no_show") {
    if (!confirm(`¿Marcar como ${status}?`)) return;
    try {
        await jsonFetch(`/api/v1/appointments/${encodeURIComponent(appointment.id)}/attendance`, {
            method: "POST",
            body: JSON.stringify({ status }),
        });
        setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, status } : a));
    } catch (e) {
        alert("Error actualizando status");
    }
  }

  // --- MAPEO DE EVENTOS PARA BIG CALENDAR ---
  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map(a => ({
      id: a.id,
      title: `${a.title || 'Cita'} (${a.status})`,
      start: new Date(a.startsAt),
      end: new Date(a.endsAt),
      resource: a, 
    }));
  }, [appointments]);

  // Estilo condicional para eventos según status
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#3b82f6'; // var(--primary) aprox
    if (event.resource.status === 'completed') backgroundColor = '#10b981';
    if (event.resource.status === 'no_show') backgroundColor = '#ef4444';
    if (event.resource.status === 'cancelled') backgroundColor = '#94a3b8';
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        padding: '2px 6px'
      }
    };
  };

  const onSelectEvent = (event: CalendarEvent) => {
    const a = event.resource;
    const action = prompt(
        `Cita: ${a.title}\nNotas: ${a.notes || '-'}\nStatus: ${a.status}\n\nEscribe 'completar' o 'noshow' para cambiar estado:`
    );
    if (action === 'completar') markAttendance(a, 'completed');
    if (action === 'noshow') markAttendance(a, 'no_show');
  };

  const onSelectSlot = ({ start, end }: { start: Date, end: Date }) => {
     setStartsAtLocal(format(start, "yyyy-MM-dd'T'HH:mm"));
     setEndsAtLocal(format(end, "yyyy-MM-dd'T'HH:mm"));
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const assigneeLabel = useMemo(() => {
    if (!assignedUserId) return membersLoading ? "Cargando..." : "Sin asignado";
    const m = members.find((x) => x.user_id === assignedUserId);
    return m ? `${m.role}` : `...`;
  }, [assignedUserId, members, membersLoading]);

  // --- STYLES (Clean UI) ---
  const styles = {
    container: {
        minHeight: "100vh",
        background: "#f8fafc", // Fondo claro
        padding: "32px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    wrapper: {
        maxWidth: "1200px",
        margin: "0 auto",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
    },
    title: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#0f172a", // Slate 900
    },
    controlGroup: {
        display: "flex",
        gap: "12px",
        alignItems: "center",
        background: "#fff",
        padding: "6px 12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
    },
    select: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
        color: "#334155",
        fontSize: "14px",
        outline: "none",
        cursor: "pointer",
    },
    card: {
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
    },
    inputGroup: {
        display: "flex",
        gap: "16px",
        flexWrap: "wrap" as const,
        alignItems: "flex-end",
    },
    inputLabel: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#475569", // Slate 600
        marginBottom: "6px",
        display: "block",
    },
    input: {
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        fontSize: "14px",
        color: "#1e293b",
        width: "100%",
        minWidth: "180px",
        backgroundColor: "#fff",
        boxSizing: "border-box" as const,
    },
    buttonPrimary: {
        background: "#2563eb", // Blue 600
        color: "white",
        border: "none",
        padding: "10px 20px",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "14px",
        transition: "background 0.2s",
        height: "42px",
        boxShadow: "0 1px 2px 0 rgba(37, 99, 235, 0.3)",
    },
    msg: {
        padding: "12px 16px",
        marginBottom: "20px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 500,
    }
  };

  return (
    <div className="ui-page-container">
      <div className="ui-wrapper">
        
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h1 className="ui-title">Calendario de Visitas</h1>
            
            <div className="ui-card" style={{ padding: "8px 16px", marginBottom: 0, display: "flex", alignItems: "center", gap: 12 }}>
                <span className="ui-label" style={{ marginBottom: 0 }}>Asignado a:</span>
                <select 
                    value={assignedUserId} 
                    onChange={e => setAssignedUserId(e.target.value)}
                    className="ui-select"
                    style={{ width: "auto", padding: "6px 12px" }}
                >
                    {members.map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.role.toUpperCase()} ({m.user_id.slice(0,4)}...)</option>
                    ))}
                </select>
            </div>
        </div>

        {msg && (
            <div className={`ui-feedback ${msg.includes("✅") ? "success" : "error"}`}>
                {msg}
            </div>
        )}

        {/* FORMULARIO RÁPIDO */}
        <div className="ui-card">
            <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ width: "4px", height: "20px", background: "var(--primary)", borderRadius: "2px", marginRight: "10px" }}></div>
                <h3 className="ui-subtitle" style={{ margin: 0 }}>Agendar Nueva Cita</h3>
            </div>
            
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                    <label className="ui-label">Fecha de Inicio</label>
                    <input type="datetime-local" value={startsAtLocal} onChange={e => setStartsAtLocal(e.target.value)} className="ui-input" />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                    <label className="ui-label">Fecha de Fin <span style={{fontWeight: 400, opacity: 0.7}}>(opcional)</span></label>
                    <input type="datetime-local" value={endsAtLocal} onChange={e => setEndsAtLocal(e.target.value)} className="ui-input" />
                </div>
                <div style={{ flex: 2, minWidth: "250px" }}>
                    <label className="ui-label">Título</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Visita Cliente..." className="ui-input" />
                </div>
                <button 
                    onClick={createAppointment} 
                    disabled={loading}
                    className="ui-btn ui-btn-primary"
                    style={{ height: "42px" }}
                >
                    {loading ? "Procesando..." : "+ Crear Evento"}
                </button>
            </div>
        </div>

        {/* CALENDARIO */}
        <div className="ui-card" style={{ height: "700px", padding: 20 }}>
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
                eventPropGetter={eventStyleGetter}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                selectable
                messages={{
                    next: "Sig", previous: "Ant", today: "Hoy", month: "Mes",
                    week: "Semana", day: "Día", agenda: "Agenda", date: "Fecha",
                    time: "Hora", event: "Evento", noEventsInRange: "Sin citas"
                }}
                culture="es"
            />
        </div>

      </div>
    </div>
  );
}