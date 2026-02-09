"use client";

import { useEffect, useMemo, useState } from "react";

type AppointmentDto = {
  id: string;
  terrenoId: string;
  assignedUserId: string;
  leadId?: string;
  title?: string;
  notes?: string;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
};

type MemberDto = {
  user_id: string;
  role: "admin" | "agent" | "installer";
};

class RequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

function toIsoStartOfDay(localDate: string) {
  // localDate: YYYY-MM-DD
  const d = new Date(`${localDate}T00:00:00`);
  return d.toISOString();
}

function toIsoEndOfDay(localDate: string) {
  const d = new Date(`${localDate}T23:59:59.999`);
  return d.toISOString();
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    const code = data?.error?.code ?? "REQUEST_FAILED";
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new RequestError(code, message);
  }

  return data as T;
}

function handleNoActiveTerreno(e: unknown): boolean {
  const err = e as any;
  if (err?.name === "RequestError" && err.code === "NO_ACTIVE_TERRENO") {
    window.location.href = "/dashboard/terrenos";
    return true;
  }
  return false;
}

function pickDefaultAssignee(members: MemberDto[]): string {
  // Prioridad: agent > admin > installer > primero
  const agent = members.find((m) => m.role === "agent")?.user_id;
  if (agent) return agent;

  const admin = members.find((m) => m.role === "admin")?.user_id;
  if (admin) return admin;

  const installer = members.find((m) => m.role === "installer")?.user_id;
  if (installer) return installer;

  return members[0]?.user_id ?? "";
}

export default function SchedulingPage() {
  const todayLocal = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [day, setDay] = useState<string>(todayLocal);

  // ahora se autoselecciona desde members
  const [assignedUserId, setAssignedUserId] = useState<string>("");

  const [startsAtLocal, setStartsAtLocal] = useState<string>(() => `${todayLocal}T10:00`);
  const [endsAtLocal, setEndsAtLocal] = useState<string>("");
  const [title, setTitle] = useState<string>("Visita");
  const [notes, setNotes] = useState<string>("");

  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    // mantener startsAtLocal alineado al día cuando cambia
    setStartsAtLocal(`${day}T10:00`);
  }, [day]);

  // Cargar miembros del terreno activo y autoseleccionar asignado
  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setMembersLoading(true);
      setMsg("");
      try {
        const data = await jsonFetch<{ members: MemberDto[] }>("/api/v1/terreno/members");
        if (cancelled) return;

        const list = data.members ?? [];
        setMembers(list);

        const picked = pickDefaultAssignee(list);
        setAssignedUserId((prev) => prev || picked);

        if (!picked) {
          setMsg("⚠️ No hay miembros en este terreno para asignar citas.");
        }
      } catch (e) {
        if (handleNoActiveTerreno(e)) return;

        const err = e as any;
        setMsg(`❌ ${err?.code ? `${err.code}: ` : ""}${err?.message ?? "Error cargando miembros"}`);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadAvailability() {
    setMsg("");

    // Si aún no hay assignee, tratamos de tomarlo desde members sin bloquear con warning feo
    const assignee = assignedUserId || pickDefaultAssignee(members);
    if (!assignee) {
      setMsg("⚠️ No hay usuario asignable. Crea/añade un miembro al terreno.");
      return;
    }
    if (!assignedUserId) setAssignedUserId(assignee);

    setLoading(true);
    try {
      const from = toIsoStartOfDay(day);
      const to = toIsoEndOfDay(day);
      const url = `/api/v1/availability?assignedUserId=${encodeURIComponent(assignee)}&from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}`;

      const data = await jsonFetch<{ appointments: AppointmentDto[] }>(url);
      setAppointments(data.appointments);
    } catch (e) {
      if (handleNoActiveTerreno(e)) return;

      const err = e as any;
      setMsg(`❌ ${err?.code ? `${err.code}: ` : ""}${err?.message ?? "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function createAppointment() {
    setMsg("");

    const assignee = assignedUserId || pickDefaultAssignee(members);
    if (!assignee) {
      setMsg("⚠️ No hay usuario asignable. Crea/añade un miembro al terreno.");
      return;
    }
    if (!assignedUserId) setAssignedUserId(assignee);

    const startsAt = new Date(startsAtLocal);
    if (Number.isNaN(startsAt.getTime())) {
      setMsg("⚠️ startsAt inválido.");
      return;
    }

    let endsAt: Date | null = null;
    if (endsAtLocal.trim()) {
      const tmp = new Date(endsAtLocal);
      if (Number.isNaN(tmp.getTime())) {
        setMsg("⚠️ endsAt inválido.");
        return;
      }
      endsAt = tmp;
    }

    setLoading(true);
    try {
      const body: any = {
        assignedUserId: assignee, // autoseleccionado
        startsAt: startsAt.toISOString(),
        ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
        ...(title ? { title } : {}),
        ...(notes ? { notes } : {}),
      };

      await jsonFetch("/api/v1/appointments", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMsg("✅ Cita creada.");
      await loadAvailability();
    } catch (e) {
      if (handleNoActiveTerreno(e)) return;

      const err = e as any;
      setMsg(`❌ ${err?.code ? `${err.code}: ` : ""}${err?.message ?? "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(id: string, status: "completed" | "no_show") {
    setMsg("");
    setLoading(true);
    try {
      await jsonFetch(`/api/v1/appointments/${encodeURIComponent(id)}/attendance`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setMsg(`✅ Attendance marcado (${status}).`);
      await loadAvailability();
    } catch (e) {
      if (handleNoActiveTerreno(e)) return;

      const err = e as any;
      setMsg(`❌ ${err?.code ? `${err.code}: ` : ""}${err?.message ?? "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  const assigneeLabel = useMemo(() => {
    if (!assignedUserId) return membersLoading ? "Cargando miembros…" : "Sin asignado";
    const m = members.find((x) => x.user_id === assignedUserId);
    return m ? `${m.role} (${assignedUserId.slice(0, 8)}…)` : `${assignedUserId.slice(0, 8)}…`;
  }, [assignedUserId, members, membersLoading]);

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ marginTop: 0 }}>Scheduling</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Día</label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>

        <div style={{ minWidth: 320 }}>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Asignado</label>
          <div style={{ fontSize: 13, color: "#333", padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}>
            {assigneeLabel}
          </div>
          <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
            Se asigna automáticamente (agent/admin). Luego lo reemplazamos por dropdown con nombre/email.
          </div>
        </div>

        <button disabled={loading} onClick={loadAvailability}>
          {loading ? "Cargando..." : "Cargar agenda"}
        </button>

        <a href="/dashboard/terrenos" style={{ alignSelf: "center" }}>
          Cambiar terreno
        </a>
      </div>

      {msg ? (
        <div style={{ padding: 10, border: "1px solid #eee", background: "#fafafa", marginBottom: 12 }}>{msg}</div>
      ) : null}

      <section style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Crear cita</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>startsAt</label>
            <input
              type="datetime-local"
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>endsAt (opcional)</label>
            <input
              type="datetime-local"
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>Si lo dejas vacío, default = +60 min</div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button disabled={loading} onClick={createAppointment}>
            {loading ? "Procesando..." : "Crear"}
          </button>
        </div>
      </section>

      <section>
        <h3>Citas del día</h3>
        {appointments.length === 0 ? <div style={{ color: "#777" }}>Sin citas.</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {appointments.map((a) => (
            <div key={a.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{a.title ?? "Cita"}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    {new Date(a.startsAt).toLocaleString()} → {new Date(a.endsAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: "#777" }}>status: {a.status}</div>
                  {a.notes ? <div style={{ fontSize: 13, marginTop: 6 }}>{a.notes}</div> : null}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button disabled={loading || a.status !== "scheduled"} onClick={() => markAttendance(a.id, "completed")}>
                    Completed
                  </button>
                  <button disabled={loading || a.status !== "scheduled"} onClick={() => markAttendance(a.id, "no_show")}>
                    No-show
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
