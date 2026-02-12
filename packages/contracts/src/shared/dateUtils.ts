import { format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

const TIMEZONE = "America/Santiago";

export const DateUtils = {
  // Convierte "2023-10-20" + "15:30" (Hora Chile) -> UTC Date real para la DB
  toUTC: (dateStr: string, timeStr: string): Date => {
    // Crea una fecha interpretando que esos inputs SON en Chile
    const combined = `${dateStr} ${timeStr}`;
    return fromZonedTime(combined, TIMEZONE);
  },

  // Convierte UTC Date (DB) -> Texto legible "Lunes 20 de Octubre..." (Hora Chile)
  formatForEmail: (isoString: string): string => {
    const date = new Date(isoString);
    const zonedDate = toZonedTime(date, TIMEZONE);

    // Ej: "viernes 20 de octubre a las 15:30"
    return format(zonedDate, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
  },

  // Convierte UTC Date (DB) -> "HH:MM" (Hora Chile) para comparar lógica
  toChileTime: (isoString: string): string => {
    const date = new Date(isoString);
    const zonedDate = toZonedTime(date, TIMEZONE);
    return format(zonedDate, "HH:mm");
  },
};
