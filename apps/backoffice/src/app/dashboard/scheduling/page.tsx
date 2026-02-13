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

// --- Tipos de Datos ---
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

// --- Helpers de Fetch ---
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
  return members[0]?.user_id ?? "";
}

// --- COMPONENTE PRINCIPAL ---
export default function SchedulingPage() {
  // Estado para creación rápida
  const todayLocal = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startsAtLocal, setStartsAtLocal] = useState<string>(() => `${todayLocal}T10:00`);
  const [endsAtLocal, setEndsAtLocal] = useState<string>("");
  const [title, setTitle] = useState<string>("Visita");
  const [notes, setNotes] = useState<string>(""); // Notas al crear (opcional)

  // Estado global UI
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Datos del Negocio
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [membersLoading, setMembersLoading] = useState(false);

  // Estado del Calendario
  const [view, setView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  
  // Estado del Modal
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDto | null>(null);

  // 1. Cargar miembros al inicio
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

  // 2. Fetch Citas (Dinámico por rango)
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


  // 3. Crear Cita
  async function createAppointment() {
    setMsg("");
    const assignee = assignedUserId || pickDefaultAssignee(members);
    if (!assignee) return setMsg("⚠️ No hay usuario asignable.");

    const startsAt = new Date(startsAtLocal);
    if (Number.isNaN(startsAt.getTime())) return setMsg("⚠️ Fecha de inicio inválida.");

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
      setMsg("✅ Cita creada correctamente.");
      fetchAppointments(currentDate, view, assignee);
      // Limpiar un poco el form
      setTitle("Visita");
      setNotes("");
    } catch (e) {
      if (!handleNoActiveTerreno(e)) {
         setMsg(`❌ Error creando cita`);
      }
    } finally {
      setLoading(false);
    }
  }

  // 4. Marcar Asistencia (Desde el Modal)
  async function markAttendance(appointment: AppointmentDto, status: "completed" | "no_show") {
    try {
        await jsonFetch(`/api/v1/appointments/${encodeURIComponent(appointment.id)}/attendance`, {
            method: "POST",
            body: JSON.stringify({ status }),
        });
        
        // Actualizar lista local del calendario
        setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, status } : a));
        
        // Actualizar estado del modal para ver el cambio instantáneo
        setSelectedAppointment(prev => prev ? { ...prev, status } : null);
        
    } catch (e) {
        alert("Error de conexión al actualizar el estado.");
    }
  }

  // --- Helpers del Calendario ---
  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map(a => ({
      id: a.id,
      title: `${a.title || 'Cita'}`, // El status ya se ve por color
      start: new Date(a.startsAt),
      end: new Date(a.endsAt),
      resource: a, 
    }));
  }, [appointments]);

  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = 'var(--primary)'; // Default Blue
    // Colores hardcodeados o variables CSS si prefieres
    if (event.resource.status === 'completed') backgroundColor = '#10b981'; // Green
    if (event.resource.status === 'no_show') backgroundColor = '#ef4444'; // Red
    if (event.resource.status === 'cancelled') backgroundColor = '#94a3b8'; // Gray
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        padding: '2px 6px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
      }
    };
  };

  const onSelectEvent = (event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
  };

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
                <div style={{ flex: 1, minWidth: "180px" }}>
                    <label className="ui-label">Inicio</label>
                    <input type="datetime-local" value={startsAtLocal} onChange={e => setStartsAtLocal(e.target.value)} className="ui-input" />
                </div>
                <div style={{ flex: 1, minWidth: "180px" }}>
                    <label className="ui-label">Fin <span style={{fontWeight: 400, opacity: 0.7}}>(opcional)</span></label>
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
                    {loading ? "..." : "+ Crear Evento"}
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

      {/* --- MODAL DE DETALLE --- */}
      {selectedAppointment && (
        <div className="ui-modal-overlay" onClick={() => setSelectedAppointment(null)}>
          <div className="ui-modal-content" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="ui-modal-header">
              <h3 className="ui-subtitle" style={{ margin: 0, fontSize: 18 }}>
                Detalles de la Cita
              </h3>
              <button 
                onClick={() => setSelectedAppointment(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 28, lineHeight: 0.5, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="ui-modal-body">
              {/* Badge de estado */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                 <span className={`ui-badge ${selectedAppointment.status}`} style={{ fontSize: 14, padding: "6px 16px" }}>
                    {selectedAppointment.status === 'no_show' ? 'NO PRESENTADO' : selectedAppointment.status.replace('_', ' ')}
                 </span>
              </div>

              <div className="ui-detail-row">
                 <span className="ui-detail-label">Título:</span>
                 <span className="ui-detail-value">{selectedAppointment.title || "Sin título"}</span>
              </div>
              
              <div className="ui-detail-row">
                 <span className="ui-detail-label">Horario:</span>
                 <span className="ui-detail-value">
                   {format(new Date(selectedAppointment.startsAt), "eeee d 'de' MMMM, HH:mm", { locale: es })}
                 </span>
              </div>

              <div style={{ margin: "20px 0", borderTop: "1px dashed var(--border-color)" }}></div>

              <h4 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-main)' }}>Notas / Info Visitante</h4>
              <div style={{ background: "var(--bg-page)", padding: 16, borderRadius: 8, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                 {selectedAppointment.notes || "No hay notas adicionales."}
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="ui-modal-footer">
               {selectedAppointment.status === 'scheduled' ? (
                 <>
                    <button 
                      onClick={() => markAttendance(selectedAppointment, 'no_show')}
                      className="ui-btn"
                      style={{ background: '#fee2e2', color: '#991b1b' }}
                    >
                      Marca Cancelada
                    </button>
                    <button 
                      onClick={() => markAttendance(selectedAppointment, 'completed')}
                      className="ui-btn"
                      style={{ background: '#dcfce7', color: '#166534' }}
                    >
                      Marcar Completada
                    </button>
                 </>
               ) : (
                 <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center', width: '100%', textAlign: 'center' }}>
                   Esta cita ya está finalizada.
                 </span>
               )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}