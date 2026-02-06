export class AppError extends Error {
    code;
    status;
    details;
    constructor(args) {
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
export function validationError(message, details) {
    return new AppError({
        code: "VALIDATION_ERROR",
        message,
        status: 400,
        ...(details ? { details } : {}),
    });
}
export function conflictOverlapError(details) {
    return new AppError({
        code: "CONFLICT_OVERLAP",
        message: "Appointment overlaps with an existing one.",
        status: 409,
        ...(details ? { details } : {}),
    });
}
export function notFoundError(message = "Not found") {
    return new AppError({ code: "NOT_FOUND", message, status: 404 });
}
export function infraError(message = "Infrastructure error", details) {
    return new AppError({
        code: "INFRA_ERROR",
        message,
        status: 500,
        ...(details ? { details } : {}),
    });
}
