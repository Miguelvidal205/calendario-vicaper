"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css"; // Importar estilos básicos

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
  resource: AppointmentDto; // Guardamos el objeto original aquí
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

  // --- LÓGICA DE CARGA DE CITAS (RANGO DINÁMICO) ---
  const fetchAppointments = useCallback(async (date: Date, view: View, userId: string) => {
    if (!userId) return;
    setLoading(true);
    setMsg("");
    
    try {
      let from: Date, to: Date;

      // Calcular rango según la vista actual
      if (view === Views.MONTH) {
        from = startOfMonth(date);
        to = endOfMonth(date);
        // Expandir un poco para ver semanas completas en la grilla
        from = startOfWeek(from, { weekStartsOn: 1 }); // Lunes
        // to = endOfWeek(to, { weekStartsOn: 1 }); 
      } else if (view === Views.WEEK) {
        from = startOfWeek(date, { weekStartsOn: 1 });
        const endWeek = new Date(from);
        endWeek.setDate(endWeek.getDate() + 7);
        to = endWeek;
      } else {
        // DAY or AGENDA
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
      // Recargar calendario
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
        // Actualizar localmente para feedback rápido
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
      resource: a, // Para tener acceso a datos extra en el click
    }));
  }, [appointments]);

  // Estilo condicional para eventos según status
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#3174ad';
    if (event.resource.status === 'completed') backgroundColor = '#10b981'; // Green
    if (event.resource.status === 'no_show') backgroundColor = '#ef4444'; // Red
    if (event.resource.status === 'cancelled') backgroundColor = '#6b7280'; // Gray
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  const onSelectEvent = (event: CalendarEvent) => {
    const a = event.resource;
    // Ejemplo: abrir un modal o mostrar detalles. Por ahora un alert simple.
    const action = prompt(
        `Cita: ${a.title}\nNotas: ${a.notes || '-'}\nStatus: ${a.status}\n\nEscribe 'completar' o 'noshow' para cambiar estado:`
    );
    if (action === 'completar') markAttendance(a, 'completed');
    if (action === 'noshow') markAttendance(a, 'no_show');
  };

  const onSelectSlot = ({ start, end }: { start: Date, end: Date }) => {
     // Al hacer click en un espacio vacío, pre-llenar el formulario de creación
     setStartsAtLocal(format(start, "yyyy-MM-dd'T'HH:mm"));
     setEndsAtLocal(format(end, "yyyy-MM-dd'T'HH:mm"));
     // Scroll arriba al form
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const assigneeLabel = useMemo(() => {
    if (!assignedUserId) return membersLoading ? "Cargando..." : "Sin asignado";
    const m = members.find((x) => x.user_id === assignedUserId);
    return m ? `${m.role}` : `...`;
  }, [assignedUserId, members, membersLoading]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      
      {/* HEADER DE CONTROL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Agenda</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
           <div style={{ fontSize: 13 }}>Viendo agenda de: <b>{assigneeLabel}</b></div>
           <select 
             value={assignedUserId} 
             onChange={e => setAssignedUserId(e.target.value)}
             style={{ padding: 5, borderRadius: 4, border: '1px solid #ccc' }}
           >
             {members.map(m => (
                 <option key={m.user_id} value={m.user_id}>{m.role} ({m.user_id.slice(0,4)}...)</option>
             ))}
           </select>
        </div>
      </div>

      {msg && <div style={{ padding: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", marginBottom: 15, borderRadius: 6 }}>{msg}</div>}

      {/* FORMULARIO RÁPIDO (Collapsible o en el tope) */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: 15, borderRadius: 8, marginBottom: 24 }}>
         <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Nueva Cita</h3>
         <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
               <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Inicio</label>
               <input type="datetime-local" value={startsAtLocal} onChange={e => setStartsAtLocal(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
            </div>
            <div>
               <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Fin (Opcional)</label>
               <input type="datetime-local" value={endsAtLocal} onChange={e => setEndsAtLocal(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
            </div>
            <div>
               <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Título</label>
               <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, width: 150 }} />
            </div>
            <button 
              onClick={createAppointment} 
              disabled={loading}
              style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", height: 34 }}
            >
              {loading ? "..." : "Crear Cita"}
            </button>
         </div>
      </div>

      {/* CALENDARIO PRINCIPAL */}
      <div style={{ height: 600, background: "white", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          view={view} // Vista actual (Month, Week, Day)
          onView={setView} // Cambiar vista
          date={currentDate} // Fecha actual visible
          onNavigate={setCurrentDate} // Navegar (Next, Prev, Today)
          eventPropGetter={eventStyleGetter}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          selectable
          messages={{
            next: "Sig",
            previous: "Ant",
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
            agenda: "Agenda",
            date: "Fecha",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Sin citas en este rango"
          }}
          culture="es" // Forzar español (requiere localizer configurado arriba)
        />
      </div>
      
    </div>
  );
}