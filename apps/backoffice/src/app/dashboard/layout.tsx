"use client";

import { useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  return (
    <html>
      <body style={{ fontFamily: "system-ui, Arial", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 260, borderRight: "1px solid #eee", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: "0 0 12px 0" }}>VICAPER</h2>
              <button onClick={logout} disabled={loading} style={{ fontSize: 12 }}>
                {loading ? "..." : "Logout"}
              </button>
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="/dashboard/scheduling">Scheduling</a>
              <a href="/dashboard/onboarding">Onboarding</a>
              <span style={{ color: "#777" }}>CRM (futuro)</span>
              <span style={{ color: "#777" }}>Lands (futuro)</span>
            </nav>
          </aside>

          <main style={{ flex: 1, padding: 16 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
