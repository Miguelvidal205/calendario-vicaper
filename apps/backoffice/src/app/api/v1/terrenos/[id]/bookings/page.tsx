"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

// Tipos locales
type Appointment = {
  id: string;
  starts_at: string;
  visitor_name: string | null;
  visitor_email: string | null;
    visitor_phone: string | null;
  status: string;
  created_at: string;
};

const CHILE_TZ = "America/Santiago";

export default function TerrenoBookingsPage() {
  const params = useParams<{ id: string }>();
  const [bookings, setBookings] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el botón de "Procesar Emails"
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/appointments`); // Usa cookie active_terreno_id
      const data = await res.json();
      if (res.ok) {
        setBookings(data.appointments || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Función DEV para forzar el envío de emails sin esperar al cron
  const triggerOutbox = async () => {
    setProcessing(true);
    setProcessResult("");
    try {
      // Necesitas el JOB_SECRET que definiste en tu env
      // NOTA: En producción esto no debe estar hardcodeado en el front, 
      // pero para tu panel de admin local es muy útil.
      // Si no quieres exponerlo, crea un endpoint intermedio en /api/admin/trigger-jobs
      const res = await fetch("/api/v1/jobs/process-outbox", {
        method: "POST",
        headers: {
          "x-job-secret": "123-secret-changeme" // <--- PON TU SECRET AQUÍ TEMPORALMENTE
        }
      });
      const data = await res.json();
      setProcessResult(`Procesados: ${data.processed}`);
    } catch (e) {
      setProcessResult("Error ejecutando job");
    } finally {
      setProcessing(false);
    }
  };

  function fmtFecha(iso: string) {
    const d = toZonedTime(new Date(iso), CHILE_TZ);
    return format(d, "dd/MM/yyyy HH:mm", { locale: es });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Reservas Recientes</h1>
            <p className="text-slate-500 text-sm">Listado de citas recibidas desde el widget público</p>
        </div>
        
        {/* HERRAMIENTA DE DESARROLLO */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-xs font-mono text-slate-400">Dev Tools:</span>
            <button 
                onClick={triggerOutbox}
                disabled={processing}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded transition disabled:opacity-50"
            >
                {processing ? "Enviando..." : "📧 Forzar Envío Emails"}
            </button>
            {processResult && <span className="text-xs text-green-600 font-semibold">{processResult}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando reservas...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No hay reservas registradas aún.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Fecha Cita (CL)</th>
                <th className="p-4 font-semibold">Visitante</th>
                <th className="p-4 font-semibold">Contacto</th>
                <th className="p-4 font-semibold">Estado</th>
                <th className="p-4 font-semibold">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="p-4 font-medium text-slate-800">
                    {fmtFecha(b.starts_at)}
                  </td>
                  <td className="p-4 text-slate-700">
                    {b.visitor_name || <span className="text-slate-400 italic">Admin (Manual)</span>}
                  </td>
                  <td className="p-4 text-slate-600">
                    <div className="flex flex-col">
                        <span>{b.visitor_email}</span>
                        <span className="text-xs text-slate-400">{b.visitor_phone}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                        ${b.status === 'scheduled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
                    `}>
                        {b.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {format(new Date(b.created_at), "dd/MM HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}