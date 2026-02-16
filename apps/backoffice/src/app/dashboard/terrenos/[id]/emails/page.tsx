import EmailSettingsForm from "./EmailSettingsForm";

export default async function Page(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>
        Configuración de Correos
      </h1>
      <p style={{ color: "#64748b", marginBottom: 18 }}>
        Personaliza el contenido de los emails transaccionales para este
        terreno.
      </p>

      <EmailSettingsForm terrenoId={id} />
    </div>
  );
}
