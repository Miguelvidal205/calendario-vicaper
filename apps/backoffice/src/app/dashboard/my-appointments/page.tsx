import { supabaseServer } from "@/lib/supabase/server";
import AppointmentRowActions from "./_components/AppoimentRowActions";

type BookingRow = {
  id: string;
  terreno_id: string;
  assigned_staff_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "no_show" | "canceled";
  outcome_note: string | null;
};

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString();
}

export default async function MyAppointmentsPage() {
  const supabase = await supabaseServer();

  // RLS hará que SOLO veas las asignadas a ti (si estás vinculado a un staff_member.user_id)
  const { data, error } = await supabase
    .from("bookings")
    .select("id,terreno_id,assigned_staff_id,client_name,client_phone,client_email,notes,starts_at,ends_at,status,outcome_note")
    .order("starts_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);

  const bookings: BookingRow[] = (data ?? []) as BookingRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mis citas</h1>
        <p className="text-sm text-gray-600">
          Aquí verás solo las citas asignadas a ti. Puedes marcar “Vino” o “No vino”.
        </p>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_180px] gap-2 bg-gray-50 p-2 text-xs font-medium">
          <div>Cliente</div>
          <div>Fecha</div>
          <div>Estado</div>
          <div className="text-right pr-2">Acciones</div>
        </div>

        {bookings.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            No tienes citas asignadas (o tu usuario no está vinculado a un agente).
          </div>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="grid grid-cols-[1.2fr_1fr_1fr_180px] gap-2 p-2 border-t items-center">
              <div className="text-sm">
                <div className="font-medium">{b.client_name}</div>
                <div className="text-xs text-gray-600">
                  {b.client_phone ?? "—"} • {b.client_email ?? "—"}
                </div>
                {b.notes && <div className="text-xs text-gray-500 mt-1">{b.notes}</div>}
                {b.outcome_note && <div className="text-xs text-gray-500 mt-1">📝 {b.outcome_note}</div>}
              </div>

              <div className="text-sm">
                <div>{fmt(b.starts_at)}</div>
                <div className="text-xs text-gray-600">hasta {fmt(b.ends_at)}</div>
              </div>

              <div className="text-sm">{b.status}</div>

              <AppointmentRowActions bookingId={b.id} currentStatus={b.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
