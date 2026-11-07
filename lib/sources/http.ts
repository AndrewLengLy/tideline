import type { z } from "zod";

const UA = "tideline/0.1 (+https://tides.andrewlengly.com)";

export class SourceError extends Error {
  constructor(
    public source: string,
    message: string,
    public status?: number,
  ) {
    super(`${source}: ${message}`);
    this.name = "SourceError";
  }
}

export interface FetchOpts {
  source: string;
  /** Seconds in the Next.js data cache. Ignored outside Next.js. */
  revalidate?: number;
  tags?: string[];
  timeoutMs?: number;
  retries?: number;
}

/** Fetches JSON and validates it. NOAA can answer 200 with {"error":...}, and that case throws too. */
export async function getJson<S extends z.ZodType>(url: string, schema: S, opts: FetchOpts): Promise<z.output<S>> {
  const { source, revalidate, tags, timeoutMs = 25_000, retries = 2 } = opts;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (revalidate !== undefined || tags) init.next = { revalidate, tags };
      const res = await fetch(url, init);
      if (!res.ok) throw new SourceError(source, `HTTP ${res.status}`, res.status);
      const json: unknown = await res.json();
      const err = (json as { error?: { message?: string } } | null)?.error;
      if (err) throw new SourceError(source, err.message ?? "error response");
      return schema.parse(json);
    } catch (e) {
      last = e;
      if (e instanceof SourceError && e.status && e.status >= 400 && e.status < 500) break;
    }
  }
  throw last instanceof Error ? last : new SourceError(source, String(last));
}
