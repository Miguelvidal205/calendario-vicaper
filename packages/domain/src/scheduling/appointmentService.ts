import type { AppointmentRepository } from "../ports/appointmentRepository";
import type { EventBus } from "../ports/eventBus";
import { conflictOverlapError, validationError } from "../errors/appError";
import type { Appointment, AppointmentStatus } from "./types";
import {
  toAppointmentAttendanceMarkedEvent,
  toAppointmentCreatedEvent,
} from "./events";

export interface AppointmentServiceDeps {
  repo: AppointmentRepository;
  events: EventBus;
  newId: () => string; // uuid generator (lo inyectamos desde app luego)
}

export class AppointmentService {
  private readonly repo: AppointmentRepository;
  private readonly events: EventBus;
  private readonly newId: () => string;

  constructor(deps: AppointmentServiceDeps) {
    this.repo = deps.repo;
    this.events = deps.events;
    this.newId = deps.newId;
  }

  async create(input: {
    terrenoId: string;
    assignedUserId: string;
    startsAt: Date;
    endsAt?: Date;
    leadId?: string;
    title?: string;
    notes?: string;
  }): Promise<Appointment> {
    const startsAt = input.startsAt;
    const endsAt =
      input.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);

    if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
      throw validationError("startsAt is invalid");
    }
    if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
      throw validationError("endsAt is invalid");
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw validationError("endsAt must be after startsAt");
    }

    try {
      const created = await this.repo.create({
        terrenoId: input.terrenoId,
        assignedUserId: input.assignedUserId,
        startsAt,
        endsAt,
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      });

      const occurredAt = new Date();
      await this.events.publish(
        toAppointmentCreatedEvent({
          eventId: this.newId(),
          terrenoId: input.terrenoId,
          occurredAt,
          appointment: created,
        }),
      );

      return created;
    } catch (err) {
      // Infra mapeará overlap idealmente; pero si alguien tiró un AppError, lo dejamos pasar.
      if (err instanceof Error && (err as any).code === "CONFLICT_OVERLAP")
        throw err;
      throw err;
    }
  }

  async availability(input: {
    terrenoId: string;
    assignedUserId: string;
    from: Date;
    to: Date;
  }): Promise<Appointment[]> {
    const from = input.from;
    const to = input.to;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw validationError("from/to is invalid");
    }
    if (to.getTime() <= from.getTime()) {
      throw validationError("to must be after from");
    }

    return this.repo.listByRange({
      terrenoId: input.terrenoId,
      assignedUserId: input.assignedUserId,
      from,
      to,
    });
  }

  async markAttendance(input: {
    terrenoId: string;
    appointmentId: string;
    status: Extract<AppointmentStatus, "completed" | "no_show">;
  }): Promise<Appointment> {
    const updated = await this.repo.markStatus({
      terrenoId: input.terrenoId,
      appointmentId: input.appointmentId,
      status: input.status,
    });

    const occurredAt = new Date();
    await this.events.publish(
      toAppointmentAttendanceMarkedEvent({
        eventId: this.newId(),
        terrenoId: input.terrenoId,
        occurredAt,
        appointment: updated,
      }),
    );

    return updated;
  }
}
