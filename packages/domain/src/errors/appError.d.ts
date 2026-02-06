export type AppErrorCode = "VALIDATION_ERROR" | "CONFLICT_OVERLAP" | "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "INFRA_ERROR";
export declare class AppError extends Error {
    readonly code: AppErrorCode;
    readonly status: number;
    readonly details?: Record<string, unknown>;
    constructor(args: {
        code: AppErrorCode;
        message: string;
        status: number;
        details?: Record<string, unknown>;
    });
}
export declare function validationError(message: string, details?: Record<string, unknown>): AppError;
export declare function conflictOverlapError(details?: Record<string, unknown>): AppError;
export declare function notFoundError(message?: string): AppError;
export declare function infraError(message?: string, details?: Record<string, unknown>): AppError;
//# sourceMappingURL=appError.d.ts.map