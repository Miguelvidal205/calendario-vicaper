import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { createStaff } from "./actions";

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  is_active: boolean | null;
  terreno_id: string;
  user_id: string | null; // para ver si está vinculado a un usuario agente
};

export const dynamic = "force-dynamic";

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "blue" | "emerald";
}) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  if (tone === "emerald")
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>
        {children}
      </span>
    );
  if (tone === "blue")
    return (
      <span className={`${base} border-blue-200 bg-blue-50 text-blue-700`}>
        {children}
      </span>
    );
  return (
    <span className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>
      {children}
    </span>
  );
}

export default async function CalendarsPage() {
  const supabase = await supabaseServer();

  const cookieStore = await cookies();
  const activeTerrenoId = cookieStore.get("active_terreno_id")?.value ?? null;

  if (!activeTerrenoId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Calendarios
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configura el equipo que atenderá las visitas por terreno.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-700">
            Selecciona un <b>Terreno activo</b> en el menú izquierdo para configurar calendarios.
          </div>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("staff_members")
    .select("id,name,email,is_active,terreno_id,user_id")
    .eq("terreno_id", activeTerrenoId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const staff: StaffRow[] = (data ?? []) as StaffRow[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Calendarios
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Administra personas del terreno y vincula agentes para que vean “Mis citas”.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Badge tone="slate">
            Terreno: <span className="ml-1 font-mono">{activeTerrenoId}</span>
          </Badge>
          <Badge tone="blue">Personas: {staff.length}</Badge>
        </div>
      </div>

      {/* Layout 2 columnas tipo mock */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Columna principal */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-6">
            <div>
              <div className="text-sm font-semibold text-slate-900">Personas</div>
              <div className="mt-1 text-xs text-slate-500">
                Haz click en una persona para configurar horarios / vincular usuario.
              </div>
            </div>

            <div className="hidden md:block">
              <Badge tone="slate">Orden: más recientes primero</Badge>
            </div>
          </div>

          {staff.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No hay personas creadas todavía.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {staff.map((s) => {
                const active = s.is_active !== false;
                return (
                  <a
                    key={s.id}
                    href={`/dashboard/calendars/${s.id}`}
                    className="block p-6 transition hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {s.name}
                          </div>
                          {active ? (
                            <Badge tone="emerald">Activo</Badge>
                          ) : (
                            <Badge tone="slate">Inactivo</Badge>
                          )}
                        </div>

                        <div className="mt-1 text-sm text-slate-600 truncate">
                          {s.email ?? "—"}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="text-slate-500">Agente vinculado:</span>
                          {s.user_id ? (
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono">
                              {s.user_id}
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                              No
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="hidden md:inline text-xs text-slate-400">
                          Ver →
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Panel derecho (Quick Actions) */}
        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Quick Actions</div>
            <div className="mt-1 text-xs text-slate-500">
              Agrega una persona al terreno activo.
            </div>

            <form action={createStaff} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nombre</label>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                  name="name"
                  placeholder="Ej: Sofía González"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Email (opcional)</label>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                  name="email"
                  placeholder="sofia@..."
                />
              </div>

              <button
                className="w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                type="submit"
              >
                Crear persona
              </button>

              
            </form>
          </section>

        </aside>
      </div>
    </div>
  );
}
