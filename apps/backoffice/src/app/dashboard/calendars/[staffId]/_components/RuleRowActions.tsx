"use client";

import { useTransition } from "react";
import { deleteAvailabilityRule, toggleAvailabilityRule } from "../actions";

export default function RuleRowActions({
  staffId,
  ruleId,
  isEnabled,
}: {
  staffId: string;
  ruleId: string;
  isEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 justify-end">
      <button
        className="text-xs border rounded-lg px-2 py-1 disabled:opacity-50"
        disabled={isPending}
        onClick={() =>
          startTransition(() => toggleAvailabilityRule(staffId, ruleId, !isEnabled))
        }
      >
        {isEnabled ? "Desactivar" : "Activar"}
      </button>

      <button
        className="text-xs border rounded-lg px-2 py-1 disabled:opacity-50"
        disabled={isPending}
        onClick={() => startTransition(() => deleteAvailabilityRule(staffId, ruleId))}
      >
        Eliminar
      </button>
    </div>
  );
}
