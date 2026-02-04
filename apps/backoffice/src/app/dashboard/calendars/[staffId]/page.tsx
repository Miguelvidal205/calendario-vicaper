import { supabaseServer } from "@/lib/supabase/server";
import {
  addAvailabilityRule,
  ensureCalendarSettings,
  saveCalendarSettings,
} from "./actions";
import RuleRowActions from "./_components/RuleRowActions";

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  is_active: boolean | null;
};

type CalendarSettingsRow = {
  staff_id: string;
  timezone: string;
  slot_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
};

type AvailabilityRuleRow = {
  id: string;
  staff_id: string;
  day_of_week: number; // 0..6
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  is_enabled: boolean;
};

const DOW_LABEL: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

function toHHMM(time: string) {
  // "HH:MM:SS" -> "HH:MM"
  return time?.slice(0, 5) ?? "";
}

export default async function StaffCalendarPage({ params }: { params: { staffId: string } }) {
  const supabase = await supabaseServer();
  const staffId = params.staffId;

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("id,name,email,is_active")
    .eq("id", staffId)
    .single();

  if (staffError) throw new Error(staffError.message);

  const { data: settings, error: settingsError } = await supabase
    .from("calendar_settings")
    .select("staff_id,timezone,slot_minutes,buffer_minutes,min_notice_minutes,max_days_ahead")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (settingsError) throw new Error(settingsError.message);

  const { data: rules, error: rulesError } = await supabase
    .from("availability_rules")
    .select("id,staff_id,day_of_week,start_time,end_time,is_enabled")
    .eq("staff_id", staffId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (rulesError) throw new Error(rulesError.message);

  const staffTyped = staff as StaffRow;
  const settingsTyped = (settings ?? null) as CalendarSettingsRow | null;
  const rulesTyped = (rules ?? []) as AvailabilityRuleRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{staffTyped.name}</h1>
        <p className="text-sm text-gray-600">{staffTyped.email ?? ""}</p>
      </div>

      {/* SETTINGS */}
      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Configuración</div>

          {!settingsTyped && (
            <form action={ensureCalendarSettings.bind(null, staffId)}>
              <button className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50">
                Crear configuración
              </button>
            </form>
          )}
        </div>

        {!settingsTyped ? (
          <div className="text-sm text-gray-600">
            Aún no hay configuración para este usuario. Crea la configuración para poder editarla.
          </div>
        ) : (
          <form
            action={saveCalendarSettings.bind(null, staffId)}
            className="grid gap-3 max-w-xl"
          >
            <label className="text-sm">
              Timezone
              <input
                className="w-full border rounded-lg p-2 mt-1"
                name="timezone"
                defaultValue={settingsTyped.timezone}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Slot (min)
                <input
                  className="w-full border rounded-lg p-2 mt-1"
                  name="slot_minutes"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={settingsTyped.slot_minutes}
                />
              </label>

              <label className="text-sm">
                Buffer (min)
                <input
                  className="w-full border rounded-lg p-2 mt-1"
                  name="buffer_minutes"
                  type="number"
                  min={0}
                  step={5}
                  defaultValue={settingsTyped.buffer_minutes}
                />
              </label>

              <label className="text-sm">
                Aviso mínimo (min)
                <input
                  className="w-full border rounded-lg p-2 mt-1"
                  name="min_notice_minutes"
                  type="number"
                  min={0}
                  step={30}
                  defaultValue={settingsTyped.min_notice_minutes}
                />
              </label>

              <label className="text-sm">
                Máx días adelante
                <input
                  className="w-full border rounded-lg p-2 mt-1"
                  name="max_days_ahead"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={settingsTyped.max_days_ahead}
                />
              </label>
            </div>

            <button className="rounded-lg bg-black text-white p-2 w-fit">
              Guardar configuración
            </button>
          </form>
        )}
      </section>

      {/* AVAILABILITY */}
      <section className="border rounded-xl p-4 space-y-4">
        <div className="font-medium">Disponibilidad semanal</div>

        <form
          action={addAvailabilityRule.bind(null, staffId)}
          className="grid md:grid-cols-4 gap-2 items-end max-w-2xl"
        >
          <label className="text-sm">
            Día
            <select className="w-full border rounded-lg p-2 mt-1" name="day_of_week" defaultValue="1">
              {Object.entries(DOW_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Inicio
            <input className="w-full border rounded-lg p-2 mt-1" name="start_time" placeholder="09:00" />
          </label>

          <label className="text-sm">
            Fin
            <input className="w-full border rounded-lg p-2 mt-1" name="end_time" placeholder="18:00" />
          </label>

          <button className="rounded-lg bg-black text-white p-2">
            Agregar franja
          </button>
        </form>

        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_140px] gap-2 bg-gray-50 p-2 text-xs font-medium">
            <div>Día</div>
            <div>Horario</div>
            <div>Estado</div>
            <div className="text-right pr-2">Acciones</div>
          </div>

          {rulesTyped.length === 0 ? (
            <div className="p-3 text-sm text-gray-600">No hay franjas cargadas todavía.</div>
          ) : (
            rulesTyped.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_1fr_1fr_140px] gap-2 p-2 border-t text-sm items-center"
              >
                <div>{DOW_LABEL[r.day_of_week] ?? `Día ${r.day_of_week}`}</div>
                <div>
                  {toHHMM(r.start_time)} - {toHHMM(r.end_time)}
                </div>
                <div>{r.is_enabled ? "Activo" : "Inactivo"}</div>
                <RuleRowActions staffId={staffId} ruleId={r.id} isEnabled={r.is_enabled} />
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-500">
          Próximo paso: agregamos “bloqueos por fecha” (feriados/vacaciones) y luego armamos la lógica de slots.
        </p>
      </section>
    </div>
  );
}
