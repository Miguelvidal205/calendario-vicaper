import { supabaseServer } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  type TerrenoRow = {
  id: string;
  nombre: string;
  marca: string | null;
  stock: number | null;
};

const { data: terrenos } = await supabase
  .from("terrenos")
  .select("id,nombre,marca,stock")
  .returns<TerrenoRow[]>(); // 👈


  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-600">Luego alimentamos métricas, leads y agenda.</p>

      <div className="border rounded-xl p-4">
        <div className="font-medium mb-2">Tus terrenos</div>
        <ul className="text-sm space-y-1">
          {(terrenos ?? []).map((t) => (
            <li key={t.id} className="flex justify-between">
              <span>{t.nombre} {t.marca ? `(${t.marca})` : ""}</span>
              <span>stock: {t.stock ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
