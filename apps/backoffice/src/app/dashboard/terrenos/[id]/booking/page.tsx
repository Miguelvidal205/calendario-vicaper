import BookingSettingsForm from "./BookingSettingsForm";

export default async function Page(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Booking público (iframe)</h1>
      <p style={{ color: "#64748b", marginBottom: 18 }}>
        Configura el calendario público para este terreno. Hora fija: <b>Chile (America/Santiago)</b>.
      </p>

      <BookingSettingsForm terrenoId={id} />
    </div>
  );
}
