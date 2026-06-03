import pino, { type Logger } from "pino";

export type AppLogger = Logger;

export function createLogger(level = "info"): AppLogger {
  return pino({
    level,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-retell-signature",
        "retellApiKey",
        "*.transcript",
        "*.recording_url"
      ],
      remove: true
    }
  });
}

