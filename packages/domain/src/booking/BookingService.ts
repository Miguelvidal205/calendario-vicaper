// packages/domain/src/booking/BookingService.ts
import { z } from "zod";
import { validationError, notFoundError } from "../errors/appError";

/**
 * Domain contracts (ports) for Booking.
 * Infra (supabase) implements these.
 */
export interface BookingAssigneeResolver {
  resolveAssignedUserId(terrenoId: string): Promise<string>;
}

export interface BookingSettings {
  terrenoId: string;
  timezone: string; // e.g. "America/Argentina/Buenos_Aires"
  dayStart: string; // "HH:MM"
  dayEnd: string; // "HH:MM" (exclusive)
  slotDurationMinutes: number; // e.g. 60
  // Optional controls
  minNoticeMinutes?: number; // minimum notice from "now" to allow a slot
  maxDaysAhead?: number; // how many days into the future
}

export interface BookingSettingsRepository {
  getByTerrenoId(terrenoId: string): Promise<BookingSettings | null>;
}

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "no_show"
  | "cancelled";

export interface AppointmentSlot {
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
}

export interface BookingAppointmentsRepository {
  listByTerrenoAndRange(input: {
    terrenoId: string;
    startsAt: Date;
    endsAt: Date;
    status?: AppointmentStatus;
  }): Promise<
    Array<{ startsAt: Date; endsAt: Date; status: AppointmentStatus }>
  >;

  createScheduledWithVisitor(input: {
    terrenoId: string;
    assignedUserId: string;
    startsAt: Date;
    endsAt: Date;
    visitorName: string;
    visitorEmail: string;
    visitorPhone: string;
    notes?: string; // exactOptionalPropertyTypes friendly
  }): Promise<{ id: string }>;
}

export interface BookingServiceDeps {
  appointments: BookingAppointmentsRepository;
  settings: BookingSettingsRepository;
  assignees: BookingAssigneeResolver;
}

export const BookingAvailabilityQuerySchema = z.object({
  terrenoId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export const BookingCreateSchema = z.object({
  terrenoId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:MM"),
  visitorName: z.string().min(1),
  visitorEmail: z.string().email(),
  visitorPhone: z.string().min(1),
  notes: z.string().optional(),
});

function parseYmdToLocalDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw validationError("date must be YYYY-MM-DD");
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(monthIndex) ||
    Number.isNaN(day) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    throw validationError("date is invalid");
  }

  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function parseHm(hm: string): { h: number; m: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) throw validationError("time must be HH:MM");
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (
    Number.isNaN(h) ||
    Number.isNaN(mm) ||
    h < 0 ||
    h > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    throw validationError("time is invalid");
  }
  return { h, m: mm };
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function toStartEndOfWorkingDay(
  dateYmd: string,
  settings: BookingSettings,
): { start: Date; end: Date } {
  const base = parseYmdToLocalDate(dateYmd);
  const { h: sh, m: sm } = parseHm(settings.dayStart);
  const { h: eh, m: em } = parseHm(settings.dayEnd);

  const start = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    sh,
    sm,
    0,
    0,
  );

  const end = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    eh,
    em,
    0,
    0,
  );

  if (end.getTime() <= start.getTime()) {
    throw validationError("booking settings dayEnd must be after dayStart");
  }

  return { start, end };
}

export class BookingService {
  private readonly appointments: BookingAppointmentsRepository;
  private readonly settings: BookingSettingsRepository;
  private readonly assignees: BookingAssigneeResolver;

  constructor(deps: BookingServiceDeps) {
    this.appointments = deps.appointments;
    this.settings = deps.settings;
    this.assignees = deps.assignees;
  }

  private async loadSettingsOrThrow(
    terrenoId: string,
  ): Promise<BookingSettings> {
    const s = await this.settings.getByTerrenoId(terrenoId);
    if (!s) throw notFoundError("Booking settings not found for terreno");
    // Defaults defensivos (por si tu tabla tiene nulls)
    return {
      terrenoId: s.terrenoId,
      timezone: s.timezone || "America/Argentina/Buenos_Aires",
      dayStart: s.dayStart || "09:00",
      dayEnd: s.dayEnd || "18:00",
      slotDurationMinutes: s.slotDurationMinutes || 60,
      ...(s.minNoticeMinutes !== undefined
        ? { minNoticeMinutes: s.minNoticeMinutes }
        : {}),
      ...(s.maxDaysAhead !== undefined ? { maxDaysAhead: s.maxDaysAhead } : {}),
    };
  }

  async getAvailability(input: { terrenoId: string; date: string }): Promise<{
    timezone: string;
    slotDurationMinutes: number;
    slots: Array<{ startsAt: Date; endsAt: Date }>;
  }> {
    const parsed = BookingAvailabilityQuerySchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(
        parsed.error.issues[0]?.message ?? "Invalid availability query",
      );
    }

    const { terrenoId, date } = parsed.data;
    const settings = await this.loadSettingsOrThrow(terrenoId);

    const { start: dayStart, end: dayEnd } = toStartEndOfWorkingDay(
      date,
      settings,
    );

    // Validaciones de ventana
    const now = new Date();
    if (settings.maxDaysAhead !== undefined) {
      const max = addMinutes(now, settings.maxDaysAhead * 24 * 60);
      if (dayStart.getTime() > max.getTime()) {
        return {
          timezone: settings.timezone,
          slotDurationMinutes: settings.slotDurationMinutes,
          slots: [],
        };
      }
    }

    const assignedUserId =
      await this.assignees.resolveAssignedUserId(terrenoId);

    const existing = await this.appointments.listByTerrenoAndRange({
      terrenoId,
      startsAt: dayStart,
      endsAt: dayEnd,
      status: "scheduled",
    });

    const slots: Array<{ startsAt: Date; endsAt: Date }> = [];
    const dur = settings.slotDurationMinutes;

    if (!Number.isFinite(dur) || dur <= 0) {
      throw validationError("slotDurationMinutes is invalid");
    }

    const minNoticeMs =
      settings.minNoticeMinutes !== undefined
        ? settings.minNoticeMinutes * 60 * 1000
        : 0;

    // Generar slots [dayStart, dayEnd)
    for (let t = new Date(dayStart.getTime()); ; t = addMinutes(t, dur)) {
      const slotStart = t;
      const slotEnd = addMinutes(slotStart, dur);
      if (slotEnd.getTime() > dayEnd.getTime()) break;

      // Min notice (desde ahora)
      if (slotStart.getTime() < now.getTime() + minNoticeMs) continue;

      // Overlap con existentes (scheduled)
      const blocked = existing.some((a) =>
        overlaps(slotStart, slotEnd, a.startsAt, a.endsAt),
      );
      if (blocked) continue;

      // (Si quisieras filtrar por assignedUserId, aquí. En tu repo actual listByTerrenoAndRange no filtra por user.)
      void assignedUserId;

      slots.push({ startsAt: slotStart, endsAt: slotEnd });
    }

    return {
      timezone: settings.timezone,
      slotDurationMinutes: settings.slotDurationMinutes,
      slots,
    };
  }

  async createBooking(input: z.infer<typeof BookingCreateSchema>): Promise<{
    id: string;
    assignedUserId: string;
    startsAt: Date;
    endsAt: Date;
  }> {
    const parsed = BookingCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(
        parsed.error.issues[0]?.message ?? "Invalid booking payload",
      );
    }

    const { terrenoId, date, time, visitorName, visitorEmail, visitorPhone } =
      parsed.data;
    const notesRaw = parsed.data.notes;

    const settings = await this.loadSettingsOrThrow(terrenoId);
    const { start: dayStart, end: dayEnd } = toStartEndOfWorkingDay(
      date,
      settings,
    );

    const base = parseYmdToLocalDate(date);
    const { h, m } = parseHm(time);

    const startsAt = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      h,
      m,
      0,
      0,
    );
    const endsAt = addMinutes(startsAt, settings.slotDurationMinutes);

    if (
      startsAt.getTime() < dayStart.getTime() ||
      endsAt.getTime() > dayEnd.getTime()
    ) {
      throw validationError("time is outside booking hours");
    }

    const now = new Date();
    if (
      settings.minNoticeMinutes !== undefined &&
      startsAt.getTime() < now.getTime() + settings.minNoticeMinutes * 60 * 1000
    ) {
      throw validationError("time is too soon");
    }

    const assignedUserId =
      await this.assignees.resolveAssignedUserId(terrenoId);

    // Chequeo overlap antes de crear
    const existing = await this.appointments.listByTerrenoAndRange({
      terrenoId,
      startsAt: addMinutes(startsAt, -settings.slotDurationMinutes),
      endsAt: addMinutes(endsAt, settings.slotDurationMinutes),
      status: "scheduled",
    });

    const blocked = existing.some((a) =>
      overlaps(startsAt, endsAt, a.startsAt, a.endsAt),
    );
    if (blocked) {
      throw validationError("Selected time is no longer available");
    }

    const notes =
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : undefined;

    // exactOptionalPropertyTypes friendly: solo agregamos notes si existe
    const created = await this.appointments.createScheduledWithVisitor({
      terrenoId,
      assignedUserId,
      startsAt,
      endsAt,
      visitorName,
      visitorEmail,
      visitorPhone,
      ...(notes ? { notes } : {}),
    });

    return { id: created.id, assignedUserId, startsAt, endsAt };
  }
}
