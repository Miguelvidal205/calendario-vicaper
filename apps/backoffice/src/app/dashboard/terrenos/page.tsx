import { supabaseServer } from "@/lib/supabase/server";
import { createTerreno } from "./actions";

type TerrenoRow = {
  id: string;
  nombre: string;
  marca: string | null;
  stock: number | null;
};

export default async function TerrenosPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("terrenos")
    .select("id,nombre,marca,stock")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const terrenos: TerrenoRow[] = (data ?? []) as TerrenoRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Terrenos</h1>
          <p className="text-sm text-gray-600">Crea y administra tus terrenos (tenants).</p>
        </div>
      </div>

      <section className="border rounded-xl p-4 space-y-3">
        <div className="font-medium">Crear terreno</div>
        <form action={createTerreno} className="grid gap-2 max-w-md">
          <input className="border rounded-lg p-2" name="nombre" placeholder="Nombre del terreno" />
          <input className="border rounded-lg p-2" name="marca" placeholder="Marca (opcional)" />
          <input className="border rounded-lg p-2" name="stock" type="number" min={0} placeholder="Stock (ej: 10)" />
          <button className="rounded-lg bg-black text-white p-2 w-fit">Crear</button>
        </form>
      </section>

      <section className="border rounded-xl p-4">
        <div className="font-medium mb-3">Mis terrenos</div>
        {terrenos.length === 0 ? (
          <div className="text-sm text-gray-600">Todavía no tienes terrenos creados.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {terrenos.map((t) => (
              <li key={t.id} className="border rounded-lg p-3 flex justify-between">
                <div>
                  <div className="font-medium">{t.nombre}</div>
                  <div className="text-gray-600">{t.marca ?? "—"}</div>
                </div>
                <div>stock: {t.stock ?? 0}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}