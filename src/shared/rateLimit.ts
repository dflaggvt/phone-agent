import type { RequestHandler } from "express";

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, now: number): Promise<RateLimitBucket>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>();

  async increment(key: string, windowMs: number, now: number): Promise<RateLimitBucket> {
    this.cleanupExpiredBuckets(now);
    const existing = this.buckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return { ...bucket };
  }

  private cleanupExpiredBuckets(now: number): void {
    if (this.buckets.size < 10_000) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

export function createRateLimiter(options: RateLimiterOptions, store: RateLimitStore = new InMemoryRateLimitStore()): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const now = Date.now();
      const key = `${options.keyPrefix}:${clientKey(req)}`;
      const bucket = await store.increment(key, options.windowMs, now);

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
    })().catch(next);
  };
}

function clientKey(req: Parameters<RequestHandler>[0]): string {
  const forwardedFor = req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
