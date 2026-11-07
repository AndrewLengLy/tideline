import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp, rateLimit } from "./lib/rate-limit";

const LIMIT_PER_MINUTE = 240;

/** Per-IP limit for this site's own API. A map session asks for about 14 requests per week of data shown. */
export function proxy(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(clientIp(request.headers), LIMIT_PER_MINUTE);
  if (ok) return NextResponse.next();
  return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

export const config = { matcher: "/api/:path*" };
