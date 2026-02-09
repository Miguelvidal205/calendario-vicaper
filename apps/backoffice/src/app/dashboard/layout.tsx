"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  function NavLink(props: { href: string; label: string }) {
    const active = pathname === props.href || pathname?.startsWith(props.href + "/");
    return (
      <a
        href={props.href}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          textDecoration: "none",
          color: active ? "#0f172a" : "#334155",
          background: active ? "#eef2ff" : "transparent",
          border: active ? "1px solid #c7d2fe" : "1px solid transparent",
          fontSize: 13,
        }}
      >
        {props.label}
      </a>
    );
  }

  function NavMuted(props: { label: string }) {
    return <div style={{ padding: "8px 10px", borderRadius: 10, color: "#94a3b8", fontSize: 13 }}>{props.label}</div>;
  }

  return (
    <div style={{ fontFamily: "system-ui, Arial", margin: 0 }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 280, borderRight: "1px solid #eee", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: "0 0 12px 0" }}>VICAPER</h2>
            <button onClick={logout} disabled={loading} style={{ fontSize: 12 }}>
              {loading ? "..." : "Logout"}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
            Backoffice / Terrenos / Agenda / Booking embebible
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <NavLink href="/dashboard/terrenos" label="Terrenos (selector)" />
            <NavLink href="/dashboard/scheduling" label="Scheduling" />
            <NavLink href="/dashboard/onboarding" label="Onboarding" />

            <div style={{ height: 12 }} />

            <div style={{ fontSize: 12, color: "#475569", margin: "6px 10px 2px" }}>Booking embebible</div>
            <NavLink href="/dashboard/booking" label="Configurar booking" />
            <NavLink href="/dashboard/booking/preview" label="Preview / iframe" />

            <div style={{ height: 12 }} />

            <div style={{ fontSize: 12, color: "#475569", margin: "6px 10px 2px" }}>Integraciones</div>
            <NavLink href="/dashboard/api-keys" label="API Keys" />

            <div style={{ height: 12 }} />

            <div style={{ fontSize: 12, color: "#475569", margin: "6px 10px 2px" }}>Próximos verticales</div>
            <NavMuted label="CRM (futuro)" />
            <NavMuted label="Lotes / Inventario (futuro)" />
            <NavMuted label="Pagos / Cuotas (futuro)" />
            <NavMuted label="Outbox Dashboard (futuro)" />
          </nav>
        </aside>

        <main style={{ flex: 1, padding: 16 }}>{children}</main>
      </div>
    </div>
  );
}
