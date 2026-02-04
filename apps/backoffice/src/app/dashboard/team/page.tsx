import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { addMemberByUserId } from "./actions";
import MemberRowActions from "./_components/MemberRowActions";

type MemberRow = {
  user_id: string;
  role: "owner" | "admin" | "staff";
  created_at: string;
};

export default async function TeamPage() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();
  const terrenoId = cookieStore.get("active_terreno_id")?.value ?? null;

  if (!terrenoId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Equipo</h1>
        <div className="border rounded-xl p-4 text-sm text-gray-700">
          Selecciona un <b>Terreno activo</b> para administrar usuarios.
        </div>
      </div>
    );
  }

const { data: membersData, error } = await supabase.rpc("terreno_list_members", {
  p_terreno_id: terrenoId,
});

  if (error) throw new Error(error.message);

  const members: MemberRow[] = (membersData ?? []) as MemberRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Equipo</h1>

      <section className="border rounded-xl p-4 space-y-3">
        <div className="font-medium">Agregar usuario existente</div>
        <p className="text-sm text-gray-600">
          Por ahora, agrega por <b>User ID</b> de Supabase Auth (usuario ya creado).
          Luego hacemos “invitar por email” con creación automática.
        </p>

        <form action={addMemberByUserId} className="grid gap-2 max-w-lg">
          <input className="border rounded-lg p-2" name="user_id" placeholder="UUID de auth.users (user_id)" />
          <select className="border rounded-lg p-2" name="role" defaultValue="staff">
            <option value="staff">staff</option>
            <option value="admin">admin</option>
          </select>
          <button className="rounded-lg bg-black text-white p-2 w-fit">Agregar</button>
        </form>
      </section>

      <section className="border rounded-xl p-4">
        <div className="font-medium mb-3">Miembros</div>

        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_220px] bg-gray-50 p-2 text-xs font-medium gap-2">
            <div>User ID</div>
            <div>Rol</div>
            <div className="text-right pr-2">Acciones</div>
          </div>

          {members.length === 0 ? (
            <div className="p-3 text-sm text-gray-600">No hay miembros todavía.</div>
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="grid grid-cols-[1fr_140px_220px] p-2 border-t gap-2 items-center">
                <div className="text-sm break-all">{m.user_id}</div>
                <div className="text-sm">{m.role}</div>
                <MemberRowActions userId={m.user_id} currentRole={m.role} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
