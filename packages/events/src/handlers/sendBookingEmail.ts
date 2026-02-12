import { AppointmentCreatedPayload } from "./types";
import { DateUtils } from "@vicaper/contracts";

export async function sendBookingEmailHandler(
  payload: AppointmentCreatedPayload,
) {
  console.log(
    `📧 [EMAIL WORKER] Preparando envío para: ${payload.visitor.email}`,
  );

  // Usamos el DateUtils para pasar de UTC (DB) a "Lunes 20 de Octubre a las 15:30"
  const fechaLegible = DateUtils.formatForEmail(payload.schedule.startsAt);

  const emailSubject = `Confirmación de Visita - VICAPER`;

  const emailBody = `
    Hola ${payload.visitor.name},
    
    Tu reserva ha sido confirmada correctamente.
    
    📅 Cuándo: ${fechaLegible} (Hora Chile)
    📍 Dónde: ${payload.metadata?.origin || "Oficinas Vicaper"}
    📝 ID Reserva: ${payload.appointmentId}
    
    Saludos,
    Equipo Vicaper.
  `;

  // AQUÍ LOGICA REAL DE ENVIO (Resend, Nodemailer, etc)
  // await resend.emails.send({...})

  console.log(`--------------------------------------------------`);
  console.log(`ASUNTO: ${emailSubject}`);
  console.log(emailBody);
  console.log(`--------------------------------------------------`);

  return true;
}
