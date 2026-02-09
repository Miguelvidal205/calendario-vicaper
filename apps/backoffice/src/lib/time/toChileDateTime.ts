export function toChileDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  const date = `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD
  const time = `${get("hour")}:${get("minute")}`; // HH:mm

  return { date, time };
}
