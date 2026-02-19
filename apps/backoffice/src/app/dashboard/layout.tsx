"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Terreno {
  id: string;
  name: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  // Estado para el terreno activo
  const [activeTerreno, setActiveTerreno] = useState<Terreno | null>(null);
  const [loadingTerreno, setLoadingTerreno] = useState(true);

  // Estado para el rol del usuario actual
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const pathname = usePathname();

  useEffect(() => {
    async function fetchLayoutData() {
      // 1. Cargar el terreno activo
      try {
        const resTerreno = await fetch("/api/v1/terrenos/active");
        if (resTerreno.ok) {
          const data = await resTerreno.json();
          if (data?.terreno) setActiveTerreno(data.terreno);
          else if (data?.id && data?.name) setActiveTerreno(data);
        }
      } catch (e) {
        console.error("No se pudo cargar terreno activo", e);
      } finally {
        setLoadingTerreno(false);
      }

      // 2. Cargar el rol del usuario para ocultar menús
      try {
        const resRole = await fetch("/api/v1/terreno/members");
        if (resRole.ok) {
          const data = await resRole.json();
          const list = data.members || [];
          const myMember = list.find(
            (m: any) => m.user_id === data.currentUserId,
          );
          if (myMember) setCurrentUserRole(myMember.role);
        }
      } catch (e) {
        console.error("No se pudo cargar el rol", e);
      }
    }

    fetchLayoutData();
  }, []);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  // --- Componentes Auxiliares de Navegación ---
  function NavLink(props: {
    href: string;
    label: string;
    icon?: React.ReactNode;
  }) {
    const isActive =
      pathname === props.href || pathname?.startsWith(props.href + "/");
    return (
      <Link
        href={props.href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 600,
          transition: "all 0.2s ease",
          marginBottom: 4,
          backgroundColor: isActive ? "#eff6ff" : "transparent",
          color: isActive ? "#2563eb" : "#64748b",
          border: isActive ? "1px solid #dbeafe" : "1px solid transparent",
        }}
      >
        {props.icon && (
          <span style={{ opacity: isActive ? 1 : 0.7 }}>{props.icon}</span>
        )}
        {props.label}
      </Link>
    );
  }

  function NavSectionTitle({ label }: { label: string }) {
    return (
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#94a3b8",
          fontWeight: 700,
          marginTop: 20,
          marginBottom: 8,
          paddingLeft: 12,
        }}
      >
        {label}
      </div>
    );
  }

  // --- Render Principal ---
  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        margin: 0,
        backgroundColor: "#f8fafc",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", height: "100%" }}>
        {/* SIDEBAR */}
        <aside
          style={{
            width: 260,
            backgroundColor: "#ffffff",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            flexShrink: 0,
          }}
        >
          {/* LOGO */}
          <div
            style={{ padding: "24px 20px", borderBottom: "1px solid #e2e8f0" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "2px solid #0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  borderRadius: 6,
                }}
              >
                V
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: "-0.5px",
                    color: "#0f172a",
                  }}
                >
                  VICAPER<span style={{ color: "#2563eb" }}>.</span>
                </h2>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontWeight: 500,
                    letterSpacing: "1px",
                  }}
                >
                  INVERSIONES
                </div>
              </div>
            </div>
          </div>

          {/* TARJETA DE TERRENO ACTIVO */}
          <div style={{ padding: "16px 12px 0 12px" }}>
            <Link
              href="/dashboard/terrenos"
              style={{
                display: "block",
                padding: "12px",
                borderRadius: 10,
                border: "1px solid #bfdbfe",
                backgroundColor: "#eff6ff",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "#b45309",
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Terreno Activo
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: "#1e293b",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  <span>🏞️</span>
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 140,
                    }}
                  >
                    {loadingTerreno
                      ? "Cargando..."
                      : activeTerreno?.name || "Seleccionar..."}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#b45309" }}>⇄</span>
              </div>
            </Link>
          </div>

          {/* NAVEGACIÓN */}
          <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
            {/* ESTO LO VEN TODOS */}
            <NavSectionTitle label="Agenda" />
            <NavLink
              href="/dashboard/scheduling"
              label="Calendario & Visitas"
              icon="📅"
            />

            {/* ESTO SOLO LO VEN ADMINS Y EJECUTIVOS REMOTOS */}
            {currentUserRole !== "agent" && (
              <>
                <NavSectionTitle label="Equipo" />
                <NavLink
                  href="/dashboard/users"
                  label="Usuarios del Sistema"
                  icon="👥"
                />

                <NavSectionTitle label="Configuración" />
                <NavLink
                  href="/dashboard/booking"
                  label="Widget Embebible"
                  icon="⚙️"
                />
                <NavLink
                  href="/dashboard/emails"
                  label="Configuración de correos"
                  icon="📧"
                />
                <NavLink
                  href="/dashboard/onboarding"
                  label="Nuevo Proyecto"
                  icon="➕"
                />
              </>
            )}
          </nav>

          {/* FOOTER USER */}
          <div
            style={{
              padding: 16,
              borderTop: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#0f172a",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {currentUserRole === "agent" ? "AG" : "AD"}
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {currentUserRole === "agent" ? "Agente" : "Admin / Ejec"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 10 }}>
                    Mi cuenta
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                disabled={loading}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "6px 10px",
                  cursor: "pointer",
                  color: "#ef4444",
                }}
                title="Cerrar Sesión"
              >
                {loading ? "..." : "⏻"}
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main
          style={{
            flex: 1,
            backgroundColor: "#f1f5f9",
            overflowY: "auto",
            height: "100%",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
