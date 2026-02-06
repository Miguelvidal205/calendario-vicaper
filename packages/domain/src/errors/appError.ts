export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "CONFLICT_OVERLAP"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INFRA_ERROR";

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(args: {
    code: AppErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "AppError";
    this.code = args.code;
    this.status = args.status;

    // exactOptionalPropertyTypes: no asignar undefined; si no hay details, omitimos
    if (args.details) {
      this.details = args.details;
    }
  }
}

export function validationError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    message,
    status: 400,
    ...(details ? { details } : {}),
  });
}

export function conflictOverlapError(
  details?: Record<string, unknown>,
): AppError {
  return new AppError({
    code: "CONFLICT_OVERLAP",
    message: "Appointment overlaps with an existing one.",
    status: 409,
    ...(details ? { details } : {}),
  });
}

export function notFoundError(message = "Not found"): AppError {
  return new AppError({ code: "NOT_FOUND", message, status: 404 });
}

export function infraError(
  message = "Infrastructure error",
  details?: Record<string, unknown>,
): AppError {
  return new AppError({
    code: "INFRA_ERROR",
    message,
    status: 500,
    ...(details ? { details } : {}),
  });
}
