import type { RequestHandler } from "express";

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(buckets, now);
    const key = `${options.keyPrefix}:${clientKey(req)}`;
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(options.maxRequests - bucket.count, 0);
    res.setHeader("RateLimit-Limit", String(options.maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count <= options.maxRequests) {
      next();
      return;
    }

    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: {
        code: "rate_limited",
        message: "Too many requests. Please try again shortly."
      }
    });
  };
}

function clientKey(req: Parameters<RequestHandler>[0]): string {
  const forwardedFor = req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function cleanupExpiredBuckets(buckets: Map<string, Bucket>, now: number): void {
  if (buckets.size < 10_000) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
