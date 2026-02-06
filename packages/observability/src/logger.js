function write(level, msg, meta) {
    const payload = {
        level,
        msg,
        ts: new Date().toISOString(),
    };
    if (meta && Object.keys(meta).length > 0)
        payload.meta = meta;
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](JSON.stringify(payload));
}
export const consoleLogger = {
    debug: (msg, meta) => write("debug", msg, meta),
    info: (msg, meta) => write("info", msg, meta),
    warn: (msg, meta) => write("warn", msg, meta),
    error: (msg, meta) => write("error", msg, meta),
};
