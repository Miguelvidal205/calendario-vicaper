"use client";

import { useMemo, useState } from "react";

export default function BookingPreviewPage() {
  const [slug, setSlug] = useState("");
  const [key, setKey] = useState("");

  const url = useMemo(() => {
    if (!slug) return "";
    const qs = key ? `?key=${encodeURIComponent(key)}` : "";
    return `/embed/booking/${encodeURIComponent(slug)}${qs}`;
  }, [slug, key]);

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ marginTop: 0 }}>Preview / iframe</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 6 }}>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim())}
            placeholder="demo-terreno"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 6 }}>Booking key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.trim())}
            placeholder="Pega la bookingKey aquí"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>URL:</div>
        <code style={{ display: "block", padding: 10, borderRadius: 10, background: "#f8fafc" }}>
          {url || "(completa slug y key)"}
        </code>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button
          disabled={!url}
          onClick={() => window.open(url, "_blank")}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
            opacity: url ? 1 : 0.6,
          }}
        >
          Abrir en nueva pestaña
        </button>
      </div>

      {url ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Iframe:</div>
          <iframe
            src={url}
            style={{
              width: "100%",
              maxWidth: 520,
              height: 720,
              border: 0,
              borderRadius: 16,
              overflow: "hidden",
              background: "#0b0f1a",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
