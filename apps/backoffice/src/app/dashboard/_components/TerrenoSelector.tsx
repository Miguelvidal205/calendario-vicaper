"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type TerrenoRow = { id: string; nombre: string };

export default function TerrenoSelector({
  terrenos,
  activeTerrenoId,
}: {
  terrenos: TerrenoRow[];
  activeTerrenoId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function setTerreno(terrenoId: string) {
    await fetch("/dashboard/active-terreno", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ terrenoId }),
    });

    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs text-gray-500">Terreno activo</div>
      <select
        className="w-full border rounded-lg p-2 text-sm"
        value={activeTerrenoId ?? ""}
        onChange={(e) => setTerreno(e.target.value)}
        disabled={isPending}
      >
        <option value="" disabled>
          Selecciona un terreno…
        </option>
        {terrenos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}