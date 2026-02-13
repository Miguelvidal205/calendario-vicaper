"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link"; 

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  
  // --- NUEVO: Estado para el terreno activo ---
  const [activeTerreno, setActiveTerreno] = useState<{ id: string; name: string } | null>(null);
  const [loadingTerreno, setLoadingTerreno] = useState(true);

  const pathname = usePathname();

  // 1. Cargar el terreno activo al montar el layout
  useEffect(() => {
    async function fetchActive() {
      try {
        // Asumimos que existe un endpoint GET que devuelve el contexto actual
        // Si tu API es diferente (ej: devuelve lista con flag), ajusta aquí.
        const res = await fetch("/api/v1/terrenos/active");
        if (res.ok) {
          const data = await res.json();
          // Ajusta esto según tu respuesta real: data.terreno, data.active, etc.
          if (data?.terreno) {
             setActiveTerreno(data.terreno);
          } else if (data?.id && data?.name) {
             setActiveTerreno(data);
          }
        }
      } catch (e) {
        console.error("No se pudo cargar terreno activo", e);
      } finally {
        setLoadingTerreno(false);
      }
    }
    fetchActive();
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

  function NavLink(props: { href: string; label: string; icon?: React.ReactNode }) {
    const isActive = pathname === props.href || pathname?.startsWith(props.href + "/");
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
          backgroundColor: isActive ? "var(--text-main)" : "transparent",
          color: isActive ? "var(--primary)" : "var(--text-secondary)",
          border: isActive ? "1px solid var(--text-main)" : "1px solid transparent",
        }}
      >
        {props.icon && <span style={{ opacity: isActive ? 1 : 0.7 }}>{props.icon}</span>}
        {props.label}
      </Link>
    );
  }

  function NavSectionTitle({ label }: { label: string }) {
    return (
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", fontWeight: 700, marginTop: 20, marginBottom: 8, paddingLeft: 12 }}>
        {label}
      </div>
    );
  }

  function NavMuted(props: { label: string }) {
    return (
      <div style={{ padding: "8px 12px", borderRadius: 8, color: "#cbd5e1", fontSize: 13, cursor: "not-allowed", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e2e8f0" }}></span>
        {props.label}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", margin: 0, backgroundColor: "var(--bg-page)", height: "100vh", overflow: "hidden" }}>
      <div style={{ display: "flex", height: "100%" }}>
        
        {/* SIDEBAR */}
        <aside style={{ width: 260, backgroundColor: "#ffffff", borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column", height: "100%", flexShrink: 0 }}>
          
          {/* LOGO */}
          <div style={{ padding: "24px 20px", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, border: "2px solid var(--text-main)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>
                    V
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-main)" }}>
                        VICAPER<span style={{ color: "var(--primary)" }}>.</span>
                    </h2>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500, letterSpacing: "1px" }}>INVERSIONES</div>
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
                    border: "1px solid var(--primary)", 
                    backgroundColor: "var(--primary-light)",
                    textDecoration: "none",
                    transition: "all 0.2s"
                }}
             >
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#b45309", fontWeight: 700, marginBottom: 4 }}>
                    Terreno Activo
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-main)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
                        <span>🏞️</span>
                        {/* Mostramos Loading o el Nombre */}
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                            {loadingTerreno ? "Cargando..." : (activeTerreno?.name || "Seleccionar")}
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#b45309" }}>⇄</span>
                </div>
             </Link>
          </div>

          {/* NAVEGACIÓN */}
          <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
            <NavSectionTitle label="Agenda" />
            <NavLink href="/dashboard/scheduling" label="Calendario & Visitas" icon="📅" />
            
            <NavSectionTitle label="Configuración" />
            <NavLink href="/dashboard/booking" label="Widget Embebible" icon="⚙️" />
            <NavLink href="/dashboard/onboarding" label="Nuevo Proyecto" icon="➕" />
            
            <NavSectionTitle label="Desarrolladores" />
            <NavLink href="/dashboard/api-keys" label="API Keys" icon="🔑" />

            <NavSectionTitle label="Próximamente" />
            <NavMuted label="CRM Clientes" />
            <NavMuted label="Inventario" />
          </nav>

          {/* FOOTER USER */}
          <div style={{ padding: 16, borderTop: "1px solid var(--border-color)", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--text-main)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        AD
                    </div>
                    <div style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>Admin</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10 }}>admin@vicaper.com</div>
                    </div>
                </div>
                <button 
                    onClick={logout} 
                    disabled={loading} 
                    style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: 6, padding: 6, cursor: "pointer", color: "#ef4444" }}
                    title="Cerrar Sesión"
                >
                    {loading ? "..." : "⏻"}
                </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, backgroundColor: "var(--bg-page)", overflowY: "auto", height: "100%" }}>
            {children}
        </main>
      </div>
    </div>
  );
}