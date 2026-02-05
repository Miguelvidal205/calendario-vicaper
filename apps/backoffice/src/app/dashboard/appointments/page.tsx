import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { createBooking } from "./actions";
import CalendarView from "./_components/CalendarView"; // Ajusta la ruta

export default async function AppointmentsPage() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();
  const terrenoId = cookieStore.get("active_terreno_id")?.value ?? null;

  if (!terrenoId) {
    return (
      <div className="card card-pad border-dashed text-center p-20">
        <p className="muted">Selecciona un terreno activo en el panel lateral.</p>
      </div>
    );
  }

  const { data: staffData } = await supabase.from("staff_members").select("*").eq("terreno_id", terrenoId);
  const { data: bookingsData } = await supabase.from("bookings").select("*").eq("terreno_id", terrenoId);

  const staff = staffData || [];
  const events = bookingsData?.map(b => ({
    title: b.client_name,
    start: b.starts_at,
    end: b.ends_at,
    backgroundColor: b.status === 'completed' ? '#10b981' : '#2563eb',
  })) || [];

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="section-title text-2xl">Gestión de Citas</h1>
          <p className="muted text-sm">Calendario maestro y agendamiento rápido.</p>
        </div>
      </header>

      {/* ESTRUCTURA DE 2 COLUMNAS COMO EL MOCK */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        
        {/* COLUMNA IZQUIERDA: CALENDARIO */}
        <section className="card overflow-hidden">
          <CalendarView events={events} />
        </section>

        {/* COLUMNA DERECHA: FORMULARIO STICKY */}
        <aside className="sticky top-24 space-y-4">
          <section className="card card-pad shadow-xl shadow-blue-900/5 border-blue-50/50 bg-white">
            <div className="mb-6">
              <h3 className="font-bold text-slate-900">Agendar Visita</h3>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-blue-500 mt-1">Acción Rápida</p>
            </div>

            <form action={createBooking} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Cliente</label>
                <input name="client_name" className="input" placeholder="Nombre completo" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Fecha</label>
                  <input name="date" type="date" className="input" required />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Inicio</label>
                  <input name="start" type="time" className="input" required />
                </div>
              </div>

              {/* Input oculto para 'end' si tu DB lo requiere, o puedes calcularlo en el action */}
              <input type="hidden" name="end" value="calculated" />

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Agente de Ventas</label>
                <select name="assigned_staff_id" className="input">
                  <option value="">Rotación automática (50/50)</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <button type="submit" className="btn btn-primary w-full py-3 font-bold mt-4 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-transform">
                Confirmar Visita
              </button>
            </form>
          </section>

          <div className="card card-pad bg-slate-50 border-none">
            <p className="text-[11px] leading-relaxed muted">
              <b>Tip:</b> Puedes arrastrar eventos en el calendario para reprogramarlos (próximamente).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}