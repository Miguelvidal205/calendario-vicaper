import { Resend } from "resend";
import { AppointmentCreatedPayload } from "./types";
import { DateUtils } from "@vicaper/contracts";

// Inicializar Resend
// Asegúrate de que process.env.RESEND_API_KEY esté disponible en el entorno donde corre el job
const resend = new Resend(process.env.RESEND_API_KEY);

// Plantilla HTML simple pero profesional
const getEmailTemplate = (
  visitorName: string,
  dateStr: string,
  origin: string,
  cancelLink: string,
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirmación de Reserva</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 20px;">
  
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    
    <div style="background-color: #2563eb; padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Reserva Confirmada!</h1>
    </div>

    <div style="padding: 30px 20px;">
      <p style="font-size: 16px;">Hola <strong>${visitorName}</strong>,</p>
      <p style="color: #555;">Tu visita ha sido agendada correctamente en nuestro sistema. Te esperamos con gusto.</p>
      
      <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; border-radius: 4px; margin: 25px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0; color: #666; width: 100px;">📅 <strong>Cuándo:</strong></td>
            <td style="font-size: 16px; font-weight: 600;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">📍 <strong>Dónde:</strong></td>
            <td>${origin}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #666;">
        Si necesitas reagendar o cancelar, por favor responde a este correo o contacta directamente a la administración.
      </p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
        <p>Enviado automáticamente por el sistema de reservas <strong>VICAPER</strong>.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export async function sendBookingEmailHandler(
  payload: AppointmentCreatedPayload,
) {
  console.log(`📧 [EMAIL] Preparando envío para: ${payload.visitor.email}`);

  if (!process.env.RESEND_API_KEY) {
    console.error("❌ CRITICAL: Falta RESEND_API_KEY en variables de entorno.");
    return false;
  }

  // 1. Formatear Fecha (Usando tu util de contratos para Timezone Chile)
  const fechaLegible = DateUtils.formatForEmail(payload.schedule.startsAt);

  // 2. Definir Origen (Nombre del Terreno o Dominio)
  const origen = payload.metadata?.origin || "Oficinas Vicaper";

  // 3. Generar HTML
  const htmlContent = getEmailTemplate(
    payload.visitor.name,
    fechaLegible,
    origen,
    "#", // Link de cancelación futura
  );

  try {
    // 4. Enviar
    // NOTA IMPORTANTE: Si no tienes dominio verificado, Resend solo deja enviar a tu propio email (el de registro).
    // Cambia 'onboarding@resend.dev' por 'reservas@tudominio.com' cuando verifiques tu dominio.
    const { data, error } = await resend.emails.send({
      from: "Reservas Vicaper <onboarding@resend.dev>",
      to: [payload.visitor.email],
      subject: `Confirmación de Visita: ${fechaLegible}`,
      html: htmlContent,
    });

    if (error) {
      console.error("❌ Error Resend:", error);
      throw new Error(error.message);
    }

    console.log(`✅ [EMAIL] Enviado con éxito. ID: ${data?.id}`);
    return true;
  } catch (err) {
    console.error("❌ Excepción en envío:", err);
    throw err; // Lanzar error permite que el Outbox reintente
  }
}
