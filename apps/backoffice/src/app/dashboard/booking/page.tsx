import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function BookingIndexPage() {
  const c = await cookies();
  const terrenoId = c.get("active_terreno_id")?.value;

  if (!terrenoId) redirect("/dashboard/terrenos");

  redirect(`/dashboard/terrenos/${terrenoId}/booking`);
}
