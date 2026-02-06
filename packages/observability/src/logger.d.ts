export type LogLevel = "debug" | "info" | "warn" | "error";
export interface Logger {
    debug(msg: string, meta?: Record<string, unknown>): void;
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(msg: string, meta?: Record<string, unknown>): void;
}
export declare const consoleLogger: Logger;
//# sourceMappingURL=logger.d.ts.map