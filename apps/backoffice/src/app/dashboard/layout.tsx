import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import TerrenoSelector from "./_components/TerrenoSelector";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: terrenosData } = await supabase
    .from("terrenos")
    .select("id,nombre")
    .order("created_at", { ascending: true });

  const cookieStore = await cookies();
  const activeTerrenoId = cookieStore.get("active_terreno_id")?.value ?? null;

  return (
    <div className="vp-shell">
      <aside className="vp-sidebar">
        <div className="flex flex-col h-full">
          <div className="mb-8">
            <h1 className="text-xl font-bold tracking-tighter text-[var(--text-dark)]">VICAPER</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest muted">Backoffice • CRM</p>
          </div>

          <div className="card p-4 mb-6 bg-slate-50/50 shadow-none border-slate-100">
            <label className="text-[10px] uppercase font-bold mb-2 block">Terreno activo</label>
            <TerrenoSelector terrenos={terrenosData || []} activeTerrenoId={activeTerrenoId} />
          </div>

          <nav className="flex flex-col gap-1">
            <NavItem href="/dashboard" label="Dashboard" icon="📊" />
            <NavItem href="/dashboard/appointments" label="Citas y Visitas" icon="📅" />
            <NavItem href="/dashboard/terrenos" label="Terrenos" icon="🏗️" />
          </nav>
          
          <div className="mt-auto border-t border-slate-100 pt-4">
             <a className="btn w-full text-center text-sm" href="/dashboard/logout">Salir</a>
          </div>
        </div>
      </aside>

      <main className="vp-main bg-[#F8FAFC]"> {/* Fondo gris claro como el mock */}
        <header className="vp-header">
          <div className="mx-auto flex w-full items-center gap-4 max-w-[1400px]">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input className="input pl-11 bg-white border-none shadow-sm" placeholder="Buscar..." />
            </div>
            <button className="btn btn-primary font-bold px-6">+ Nueva Visita</button>
          </div>
        </header>

        <section className="vp-content">
          <div className="mx-auto max-w-[1400px]">
            {children} {/* Aquí entrará el grid de dos columnas */}
          </div>
        </section>
      </main>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-white hover:shadow-sm hover:text-[var(--primary)] transition-all">
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </a>
  );
}