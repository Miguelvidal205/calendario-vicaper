"use client";

import { useState, useTransition } from "react";

export default function AppointmentRowActions({
  bookingId,
  currentStatus,
}: {
  bookingId: string;
  currentStatus: "scheduled" | "completed" | "no_show" | "canceled";
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  async function update(status: "completed" | "no_show") {
    await fetch("/dashboard/my-appointments/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId, status, note }),
    });
    // refresca UI
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        className="border rounded-lg p-2 text-xs w-[180px]"
        placeholder="Nota (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isPending}
      />

      <div className="flex gap-2">
        <button
          className="text-xs border rounded-lg px-2 py-1 disabled:opacity-50"
          disabled={isPending || currentStatus !== "scheduled"}
          onClick={() => startTransition(() => update("completed"))}
        >
          Vino
        </button>

        <button
          className="text-xs border rounded-lg px-2 py-1 disabled:opacity-50"
          disabled={isPending || currentStatus !== "scheduled"}
          onClick={() => startTransition(() => update("no_show"))}
        >
          No vino
        </button>
      </div>
    </div>
  );
}
