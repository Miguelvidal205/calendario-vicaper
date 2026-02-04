"use client";

import { useTransition } from "react";
import { removeMember, setMemberRole } from "../actions";

export default function MemberRowActions({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: "owner" | "admin" | "staff";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 justify-end">
      <select
        className="border rounded-lg p-2 text-sm disabled:opacity-50"
        defaultValue={currentRole}
        disabled={isPending || currentRole === "owner"} // no toques owner desde aquí
        onChange={(e) => startTransition(() => setMemberRole(userId, e.target.value))}
      >
        <option value="admin">admin</option>
        <option value="staff">staff</option>
        <option value="owner">owner</option>
      </select>

      <button
        className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        disabled={isPending || currentRole === "owner"}
        onClick={() => startTransition(() => removeMember(userId))}
      >
        Remover
      </button>
    </div>
  );
}
