"use client";
import { useEffect, useState } from "react";

async function jsonFetch<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.error?.message ?? "Error");
  return data as T;
}

type UserRole = "admin" | "remote_exec" | "agent";

// 1. Asegurarnos de que el tipo de dato reciba el color
interface SystemUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  workingHours?: any;
  color?: string; // <-- Agregado
}

const DIAS_SEMANA = [
  { key: "1", label: "Lunes" },
  { key: "2", label: "Martes" },
  { key: "3", label: "Miércoles" },
  { key: "4", label: "Jueves" },
  { key: "5", label: "Viernes" },
  { key: "6", label: "Sábado" },
];

const defaultSchedule = DIAS_SEMANA.reduce(
  (acc, dia) => ({
    ...acc,
    [dia.key]: { enabled: dia.key !== "6", start: "09:00", end: "18:00" },
  }),
  {} as any,
);

export default function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // 2. Estado del formulario con el color por defecto incluido
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "agent",
    color: "#3b82f6", // <-- Azul por defecto
  });
  const [workingHours, setWorkingHours] = useState(defaultSchedule);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await jsonFetch<{ users: SystemUser[] }>(
        "/api/v1/terreno/users",
      );
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // 3. Resetear el color al abrir para crear
  const openCreateModal = () => {
    setModalMode("create");
    setSelectedUserId(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "agent",
      color: "#3b82f6", // <-- Resetear color
    });
    setWorkingHours(defaultSchedule);
    setShowModal(true);
  };

  // 4. Cargar el color existente al abrir para editar
  const openEditModal = (user: SystemUser) => {
    setModalMode("edit");
    setSelectedUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      role: user.role,
      color: user.color || "#3b82f6", // <-- Cargar el color del usuario o default
    });

    if (user.role === "agent" && user.workingHours) {
      setWorkingHours({ ...defaultSchedule, ...user.workingHours });
    } else {
      setWorkingHours(defaultSchedule);
    }

    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Al hacer ...form, estamos enviando form.color automáticamente
      if (modalMode === "create") {
        await jsonFetch("/api/v1/terreno/users", {
          method: "POST",
          body: JSON.stringify({ ...form, workingHours }),
        });
      } else {
        await jsonFetch("/api/v1/terreno/users", {
          method: "PUT",
          body: JSON.stringify({ id: selectedUserId, ...form, workingHours }),
        });
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (dayKey: string, field: string, value: any) => {
    setWorkingHours((prev: any) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  return (
    <div className="ui-page-container">
      <div className="ui-wrapper">
        <div
          className="header-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <h1 className="ui-title">Usuarios del Sistema</h1>
          <button onClick={openCreateModal} className="ui-btn ui-btn-primary">
            + Nuevo Usuario
          </button>
        </div>

        {error && <div className="ui-feedback error">{error}</div>}

        <div className="ui-card">
          {loading ? (
            <p>Cargando usuarios...</p>
          ) : (
            <table
              style={{
                width: "100%",
                textAlign: "left",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    color: "#64748b",
                  }}
                >
                  <th style={{ padding: "12px 8px" }}>Nombre / Email</th>
                  <th style={{ padding: "12px 8px" }}>Teléfono</th>
                  <th style={{ padding: "12px 8px" }}>Rol y Color</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {user.email}
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px", color: "#475569" }}>
                      {user.phone || "-"}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {/* 5. Círculo de color en la tabla para ver si se guardó bien */}
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            backgroundColor: user.color || "#ccc",
                            border: "1px solid #cbd5e1",
                          }}
                        ></div>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "999px",
                            fontSize: 12,
                            backgroundColor: "#e2e8f0",
                          }}
                        >
                          {user.role.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      <button
                        onClick={() => openEditModal(user)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#2563eb",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL CREAR / EDITAR USUARIO */}
        {showModal && (
          <div
            className="ui-modal-overlay"
            onClick={() => setShowModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <div
              className="ui-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                padding: 24,
                borderRadius: 12,
                width: 450,
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {modalMode === "create"
                  ? "Crear Nuevo Usuario"
                  : "Editar Usuario"}
              </h3>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  placeholder="Nombre Completo"
                  className="ui-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                {modalMode === "create" && (
                  <>
                    <input
                      placeholder="Correo (ej: luis@empresa.com)"
                      type="email"
                      className="ui-input"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                    <input
                      placeholder="Contraseña Temporal"
                      type="password"
                      className="ui-input"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                  </>
                )}
                {modalMode === "edit" && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      background: "#f1f5f9",
                      padding: "8px 12px",
                      borderRadius: 6,
                    }}
                  >
                    Email: <strong>{form.email}</strong> (No editable aquí)
                  </div>
                )}

                <input
                  placeholder="Teléfono (ej: +569...)"
                  type="text"
                  className="ui-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <select
                      className="ui-select"
                      style={{ width: "100%" }}
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                    >
                      <option value="agent">Agente de Terreno</option>
                      <option value="remote_exec">Ejecutivo Remoto</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  {/* Selector de color */}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <label
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Color:
                    </label>
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                      style={{
                        width: 36,
                        height: 36,
                        padding: 0,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                      title="Color en el Calendario"
                    />
                  </div>
                </div>

                {/* HORARIOS: Solo visible para agentes de terreno */}
                {form.role === "agent" && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background: "#f8fafc",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 10px 0",
                        fontSize: 13,
                        color: "#475569",
                      }}
                    >
                      Disponibilidad Horaria
                    </h4>
                    {DIAS_SEMANA.map((dia) => (
                      <div
                        key={dia.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={workingHours[dia.key].enabled}
                          onChange={(e) =>
                            updateSchedule(dia.key, "enabled", e.target.checked)
                          }
                        />
                        <span style={{ width: 70 }}>{dia.label}</span>
                        <input
                          type="time"
                          disabled={!workingHours[dia.key].enabled}
                          value={workingHours[dia.key].start}
                          onChange={(e) =>
                            updateSchedule(dia.key, "start", e.target.value)
                          }
                          style={{
                            padding: 4,
                            borderRadius: 4,
                            border: "1px solid #ccc",
                          }}
                        />
                        <span>-</span>
                        <input
                          type="time"
                          disabled={!workingHours[dia.key].enabled}
                          value={workingHours[dia.key].end}
                          onChange={(e) =>
                            updateSchedule(dia.key, "end", e.target.value)
                          }
                          style={{
                            padding: 4,
                            borderRadius: 4,
                            border: "1px solid #ccc",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    marginTop: 12,
                  }}
                >
                  <button
                    onClick={() => setShowModal(false)}
                    className="ui-btn"
                    style={{ background: "#eee" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="ui-btn ui-btn-primary"
                  >
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
