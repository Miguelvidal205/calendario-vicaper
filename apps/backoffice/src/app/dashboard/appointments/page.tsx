import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { createBooking } from "./actions";

type StaffRow = {
  id: string;
  name: string;
  is_active: boolean | null;
};

type BookingRow = {
  id: string;
  client_name: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "no_show" | "canceled";
  assigned_staff_id: string;
};

function fmtShort(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: BookingRow["status"] }) {
  const statusMap = {
    completed: { label: "Completada", class: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    no_show: { label: "No vino", class: "border-rose-200 bg-rose-50 text-rose-700" },
    canceled: { label: "Cancelada", class: "border-slate-200 bg-slate-50 text-slate-700" },
    scheduled: { label: "Agendada", class: "border-blue-200 bg-blue-50 text-blue-700" },
  };

  const config = statusMap[status] || statusMap.scheduled;
  return (
    <span className={`badge ${config.class}`}>
      {config.label}
    </span>
  );
}

export default async function AppointmentsPage() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();
  const terrenoId = cookieStore.get("active_terreno_id")?.value ?? null;

  if (!terrenoId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="section-title text-2xl">Citas</h1>
          <p className="muted">Selecciona un terreno activo para gestionar las visitas.</p>
        </div>
        <div className="card card-pad border-dashed border-2 flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <p className="font-medium text-slate-600">No hay un terreno seleccionado</p>
            <p className="text-xs muted mt-1">Usa el selector del panel lateral para continuar.</p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch de datos
  const { data: staffData } = await supabase
    .from("staff_members")
    .select("id,name,is_active")
    .eq("terreno_id", terrenoId)
    .order("created_at", { ascending: true });

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("id,client_name,starts_at,ends_at,status,assigned_staff_id")
    .eq("terreno_id", terrenoId)
    .order("starts_at", { ascending: true })
    .limit(100);

  const staff = (staffData ?? []) as StaffRow[];
  const bookings = (bookingsData ?? []) as BookingRow[];
  const staffById = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      {/* HEADER DE PÁGINA */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="section-title text-2xl">Gestión de Citas</h1>
          <p className="muted">Panel central de visitas para el terreno activo.</p>
        </div>
        <div className="hidden md:block">
          <div className="badge bg-white shadow-sm px-4 py-2">
            Total visitas: <b className="text-[var(--primary)]">{bookings.length}</b>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        
        {/* COLUMNA PRINCIPAL: LISTADO */}
        <section className="card">
          <header className="flex items-center justify-between border-b border-[var(--border)] p-5">
            <div className="font-bold tracking-tight">Próximas visitas</div>
            <div className="flex gap-2">
              <select className="input py-1 text-sm w-auto">
                <option>Todos los agentes</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn text-sm py-1 font-medium">Hoy</button>
            </div>
          </header>

          <div className="divide-y divide-[var(--border)]">
            {bookings.length === 0 ? (
              <div className="p-10 text-center muted text-sm">No hay citas programadas para este terreno.</div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-slate-50/50 transition-colors gap-4">
                  <div className="flex items-start gap-4">
                    {/* Indicador visual VICAPER */}
                    <div className="mt-1 h-10 w-1 rounded-full bg-[var(--primary)] shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{b.client_name}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-1 text-xs font-medium flex items-center gap-2">
                        <span className="text-slate-500">{fmtShort(b.starts_at)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-slate-500">{fmtShort(b.ends_at)}</span>
                        <span className="text-slate-300 mx-1">•</span>
                        <span className="text-[var(--primary)]">{staffById.get(b.assigned_staff_id) || "Asignación Automática"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn text-xs font-bold px-4 py-2">Detalles</button>
                    <button className="btn btn-primary text-xs font-bold px-4 py-2">Gestionar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* PANEL LATERAL: AGENDAR */}
        <aside className="space-y-4">
          <section className="card card-pad bg-white">
            <div className="mb-4">
              <h3 className="font-bold text-slate-900">Agendar Visita</h3>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Acción Rápida</p>
            </div>

            <form action={createBooking} className="space-y-4">
              <div>
                <label>NOMBRE DEL CLIENTE</label>
                <input name="client_name" className="input" placeholder="Ej. Juan Pérez" required />
              </div>

              <div className="grid-2">
                <div>
                  <label>FECHA</label>
                  <input name="date" type="date" className="input" required />
                </div>
                <div>
                  <label>HORA INICIO</label>
                  <input name="start" type="time" className="input" required />
                </div>
              </div>

              <div>
                <label>AGENTE DE VENTAS</label>
                <select name="assigned_staff_id" className="input">
                  <option value="">Rotación automática (50/50)</option>
                  {staff.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>CONTACTO (WHATSAPP)</label>
                <input name="client_phone" className="input" placeholder="+54..." />
              </div>

              <button type="submit" className="btn btn-primary w-full py-3 font-bold mt-2 shadow-lg shadow-blue-600/20">
                Confirmar Visita
              </button>
            </form>
          </section>

          <div className="card card-pad bg-[var(--bg-main)] border-dashed">
            <p className="text-[11px] leading-relaxed muted">
              <b>Nota:</b> Al guardar la visita, el sistema notificará automáticamente al agente asignado y enviará un recordatorio al cliente.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}