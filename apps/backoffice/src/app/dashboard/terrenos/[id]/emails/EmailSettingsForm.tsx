"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner"; // Opcional si usas sonner, sino usamos el estado local 'notice'

export default function EmailSettingsForm(props: { terrenoId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Estados del formulario
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Cargar configuración inicial
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      setLoading(true);
      try {
        // Usamos el mismo endpoint GET que booking-settings, asumiendo que devuelve todo
        // O si prefieres uno específico, ajusta la URL.
        const res = await fetch(
          `/api/v1/terrenos/${props.terrenoId}/booking-settings`,
        );
        const data = await res.json();

        if (!res.ok)
          throw new Error(data?.message ?? "Error cargando configuración");
        if (cancelled) return;

        // Defaults si vienen vacíos
        setSubject(data.mail_subject || "Confirmación de Visita");
        setBody(
          data.mail_body ||
            "Hola {{name}}, tu visita está confirmada para el {{date}} a las {{time}}.",
        );
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [props.terrenoId]);

  // Guardar configuración
  async function saveSettings() {
    setNotice(null);
    setError(null);
    setSaving(true);

    if (!subject.trim() || !body.trim()) {
      setError("El asunto y el mensaje no pueden estar vacíos.");
      setSaving(false);
      return;
    }

    try {
      // Usamos PATCH para actualizar solo los campos de correo
      // O POST al mismo endpoint si tu backend maneja updates parciales
      const res = await fetch(
        `/api/v1/terrenos/${props.terrenoId}/booking-settings`,
        {
          method: "POST", // Tu endpoint actual usa POST para todo el update
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            // IMPORTANTE: Aquí deberíamos enviar SOLO lo que cambió si tu API lo soporta.
            // Si tu API requiere enviar TODO el objeto de settings (horarios, etc.),
            // entonces este componente necesitaría cargar todo el estado global.
            //
            // ASUMIENDO QUE TU API HACE MERGE (UPDATE PARCIAL):
            mail_subject: subject,
            mail_body: body,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "No se pudo guardar");

      setNotice("Configuración de correo guardada correctamente ✅");
      toast.success("Correos actualizados");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Insertar variable en la posición del cursor (simple append por ahora)
  function insertVariable(variable: string) {
    setBody((prev) => prev + ` ${variable} `);
  }

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", padding: 20 }}>
        Cargando configuración de correos...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
      {/* SECCIÓN: Editor de Plantilla */}
      <section className="ui-card">
        <h2 className="ui-subtitle">Plantilla de Confirmación</h2>
        <p
          style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}
        >
          Este correo se envía automáticamente al cliente cuando completa una
          reserva exitosa.
        </p>

        <div style={{ display: "grid", gap: 16 }}>
          {/* Asunto */}
          <div>
            <label className="ui-label">Asunto del Correo</label>
            <input
              type="text"
              className="ui-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: Confirmación de reserva - Parcelas del Sur"
            />
          </div>

          {/* Cuerpo */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <label className="ui-label" style={{ marginBottom: 0 }}>
                Mensaje
              </label>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Texto simple
              </div>
            </div>

            <textarea
              className="ui-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{
                height: 200,
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
              }}
              placeholder="Escribe el contenido del correo aquí..."
            />

            {/* Toolbar de Variables */}
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                }}
              >
                Variables Dinámicas:
              </span>

              <button
                onClick={() => insertVariable("{{name}}")}
                className="ui-badge"
                style={{
                  cursor: "pointer",
                  border: "1px solid #cbd5e1",
                  background: "white",
                }}
                title="Nombre del cliente"
              >
                {"{{name}}"}
              </button>

              <button
                onClick={() => insertVariable("{{date}}")}
                className="ui-badge"
                style={{
                  cursor: "pointer",
                  border: "1px solid #cbd5e1",
                  background: "white",
                }}
                title="Fecha legible (ej: Lunes 12 de Octubre)"
              >
                {"{{date}}"}
              </button>

              <button
                onClick={() => insertVariable("{{time}}")}
                className="ui-badge"
                style={{
                  cursor: "pointer",
                  border: "1px solid #cbd5e1",
                  background: "white",
                }}
                title="Hora de la cita (ej: 14:30)"
              >
                {"{{time}}"}
              </button>
            </div>
          </div>

          {/* Botón Guardar */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 10,
            }}
          >
            <button
              onClick={saveSettings}
              disabled={saving}
              className="ui-btn ui-btn-primary"
              style={{ width: "160px" }}
            >
              {saving ? "Guardando..." : "Guardar Plantilla"}
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        <div style={{ marginTop: 20 }}>
          {error && <div className="ui-feedback error">{error}</div>}
          {notice && <div className="ui-feedback success">{notice}</div>}
        </div>
      </section>

      {/* SECCIÓN: Preview Visual (Opcional pero útil) */}
      <section className="ui-card" style={{ background: "#f8fafc" }}>
        <h2
          className="ui-subtitle"
          style={{ fontSize: 14, color: "var(--text-muted)" }}
        >
          Vista Previa Aproximada
        </h2>

        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            overflow: "hidden",
            maxWidth: 600,
            margin: "0 auto",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Header Simulado */}
          <div
            style={{
              background: "#2563eb",
              padding: "20px",
              textAlign: "center",
              color: "white",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18 }}>
              {subject || "(Sin asunto)"}
            </h3>
          </div>

          {/* Body Simulado */}
          <div
            style={{
              padding: 30,
              color: "#334155",
              lineHeight: 1.6,
              fontSize: 14,
              whiteSpace: "pre-wrap",
            }}
          >
            {body
              ? body
                  .replace("{{name}}", "Juan Pérez")
                  .replace("{{date}}", "Lunes 24 de Agosto")
                  .replace("{{time}}", "10:00")
              : "(Cuerpo del mensaje vacío)"}

            {/* Card de Detalles Fijos (Simulación) */}
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: "#f1f5f9",
                borderRadius: 6,
                borderLeft: "4px solid #2563eb",
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                📅 FECHA
              </div>
              <div style={{ fontWeight: 600 }}>Lunes 24 de Agosto, 10:00</div>
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              padding: 12,
              textAlign: "center",
              fontSize: 11,
              color: "#94a3b8",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            Enviado automáticamente por Vicaper
          </div>
        </div>
      </section>
    </div>
  );
}
