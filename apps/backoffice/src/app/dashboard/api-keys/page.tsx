"use client";

import { useEffect, useState } from "react";

type KeyRow = {
  id: string;
  name: string | null;
  last4: string | null;
  created_at: string;
  revoked_at: string | null;
};

class RequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new RequestError(data?.error?.code ?? "REQUEST_FAILED", data?.error?.message ?? "Request failed");
  return data as T;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("Integración 1");
  const [newKeyValue, setNewKeyValue] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const data = await jsonFetch<{ keys: KeyRow[] }>("/api/v1/api-keys");
      setKeys(data.keys ?? []);
    } catch (e) {
      const err = e as any;
      setMsg(`❌ ${err.code ? `${err.code}: ` : ""}${err.message ?? "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createKey() {
    setMsg("");
    setNewKeyValue("");
    setLoading(true);
    try {
      const data = await jsonFetch<{ key: KeyRow; apiKey: string }>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewKeyValue(data.apiKey);
      await load();
      setMsg("✅ Key creada. Copia el valor (solo se muestra una vez).");
    } catch (e) {
      const err = e as any;
      setMsg(`❌ ${err.code ? `${err.code}: ` : ""}${err.message ?? "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    setMsg("");
    setLoading(true);
    try {
      await jsonFetch(`/api/v1/api-keys/${encodeURIComponent(id)}/revoke`, { method: "POST" });
      await load();
      setMsg("✅ Key revocada.");
    } catch (e) {
      const err = e as any;
      setMsg(`❌ ${err.code ? `${err.code}: ` : ""}${err.message ?? "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ marginTop: 0 }}>API Keys</h1>
      <p style={{ color: "#666" }}>
        Crea keys para integraciones externas. El valor completo se muestra solo una vez.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 360 }}>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </div>
        <button disabled={loading} onClick={createKey}>
          {loading ? "Creando..." : "Crear API Key"}
        </button>
        <button disabled={loading} onClick={load}>
          Refrescar
        </button>
      </div>

      {newKeyValue ? (
        <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee", background: "#fafafa", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Copia tu API Key ahora:</div>
          <code style={{ wordBreak: "break-all" }}>{newKeyValue}</code>
        </div>
      ) : null}

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee", background: "#fafafa" }}>{msg}</div>
      ) : null}

      <h3 style={{ marginTop: 18 }}>Keys existentes</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {keys.map((k) => (
          <div key={k.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{k.name ?? "(sin nombre)"}</div>
                <div style={{ fontSize: 12, color: "#777" }}>last4: {k.last4 ?? "----"}</div>
                <div style={{ fontSize: 12, color: "#777" }}>created: {new Date(k.created_at).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: k.revoked_at ? "#b91c1c" : "#15803d" }}>
                  {k.revoked_at ? `revoked: ${new Date(k.revoked_at).toLocaleString()}` : "active"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button disabled={loading || !!k.revoked_at} onClick={() => revokeKey(k.id)}>
                  Revoke
                </button>
              </div>
            </div>
          </div>
        ))}
        {keys.length === 0 ? <div style={{ color: "#777" }}>No hay keys aún.</div> : null}
      </div>
    </div>
  );
}
