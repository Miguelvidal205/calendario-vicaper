// apps/backoffice/src/app/embed/booking/[slug]/page.tsx
import BookingWidget from "./widget";

export default async function Page(ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  return (
    <main style={{ fontFamily: "system-ui", padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <BookingWidget slug={slug} />
    </main>
  );
}
