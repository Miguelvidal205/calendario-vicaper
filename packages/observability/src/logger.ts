export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function write(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    level,
    msg,
    ts: new Date().toISOString(),
  };
  if (meta && Object.keys(meta).length > 0) payload.meta = meta;
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](JSON.stringify(payload));
}

export const consoleLogger: Logger = {
  debug: (msg, meta) => write("debug", msg, meta),
  info: (msg, meta) => write("info", msg, meta),
  warn: (msg, meta) => write("warn", msg, meta),
  error: (msg, meta) => write("error", msg, meta),
};
