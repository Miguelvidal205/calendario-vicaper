import { Resend } from "resend";
import { DateUtils } from "@vicaper/contracts";

const resend = new Resend(process.env.RESEND_API_KEY);

function replaceVariables(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] || "";
  });
}

export async function sendBookingEmailHandler(payload: any) {
  // LOG PARA VER QUÉ LLEGA AL WORKER
  console.log(
    "📨 [WORKER] Payload recibido:",
    JSON.stringify(payload.emailTemplate, null, 2),
  );

  if (!process.env.RESEND_API_KEY) {
    console.error("❌ CRITICAL: Falta RESEND_API_KEY.");
    return false;
  }

  // 1. Variables
  const fechaLegible = DateUtils.formatForEmail(payload.schedule.startsAt);
  const horaLegible = DateUtils.toChileTime(payload.schedule.startsAt);

  const variables = {
    name: payload.visitor.name,
    email: payload.visitor.email,
    date: fechaLegible,
    time: horaLegible,
    origin: payload.metadata?.origin || "Vicaper",
  };

  // 2. Extraer Template (Aquí está la magia)
  // Si payload.emailTemplate es undefined, usa el default.
  const templateConfig = payload.emailTemplate || {};

  const rawSubject =
    templateConfig.subject || "Confirmación de Visita (Default)";
  const rawBody =
    templateConfig.body ||
    "Hola {{name}}, tu visita está confirmada (Default).";

  // 3. Reemplazar
  const finalSubject = replaceVariables(rawSubject, variables);
  const finalBodyText = replaceVariables(rawBody, variables);

  console.log(`📧 [WORKER] Enviando Subject: "${finalSubject}"`);

  // 4. HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px; color: #333;">
      <div style="background: #f4f4f5; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2563eb;">${finalSubject}</h2>
        <p style="white-space: pre-wrap; font-size: 16px;">${finalBodyText}</p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="font-size: 14px; color: #666;">
          📅 <strong>Fecha:</strong> ${fechaLegible}<br>
          ⏰ <strong>Hora:</strong> ${horaLegible}
        </p>
      </div>
    </body>
    </html>
  `;

  // 5. Enviar
  await resend.emails.send({
    from: "Reservas Vicaper <onboarding@resend.dev>",
    to: [payload.visitor.email],
    subject: finalSubject,
    html: htmlContent,
  });

  return true;
}
