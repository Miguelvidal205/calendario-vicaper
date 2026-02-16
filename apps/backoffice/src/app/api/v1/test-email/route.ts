import { NextResponse } from "next/server";
// Ajusta este import según cómo exportes tu handler desde el paquete 'events'
// Si no lo tienes exportado en el index, usa la ruta relativa o copia la función aquí temporalmente.
import { sendBookingEmailHandler } from "@vicaper/events";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // IMPORTANTE: En modo prueba de Resend, este email DEBE ser el mismo
    // con el que te registraste en Resend.com
    const targetEmail = body.email || "miguelvidal205@gmail.com";

    console.log(`🧪 [TEST] Intentando enviar email a: ${targetEmail}`);
    console.log(
      `🔑 [TEST] Chequeando API Key: ${process.env.RESEND_API_KEY ? "Existe ✅" : "Falta ❌"}`,
    );

    // Mock de datos (simulamos una cita)
    const mockPayload = {
      appointmentId: "test-id-123",
      terrenoId: "test-terreno",
      visitor: {
        name: "Usuario de Prueba",
        email: targetEmail,
        phone: "+56912345678",
      },
      schedule: {
        startsAt: new Date().toISOString(), // Ahora
        endsAt: new Date(Date.now() + 3600000).toISOString(), // +1 hora
      },
      metadata: {
        origin: "Test Endpoint API",
      },
    };

    // Llamamos directo al handler (sin worker)
    // @ts-ignore
    const result = await sendBookingEmailHandler(mockPayload);

    return NextResponse.json({
      success: true,
      sentTo: targetEmail,
      handlerResult: result,
    });
  } catch (error: any) {
    console.error("❌ [TEST FAILED]", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
