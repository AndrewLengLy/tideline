// Per-IP sliding-window limiter for this site's own /api routes. State lives in the
// instance serving the request, so the limit applies per instance. That is enough to
// stop one client from hammering NOAA through this site.
const buckets = new Map<string, number[]>();

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfter: number } {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
