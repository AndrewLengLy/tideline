import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

/** Daily cron target. Marks cached predictions stale so the next visit rebuilds the 12-month window. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const ua = request.headers.get("user-agent") ?? "";
  const allowed = secret ? auth === `Bearer ${secret}` : process.env.NODE_ENV !== "production" || ua.startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag("predictions", "max");
  return Response.json({ revalidated: ["predictions"], at: new Date().toISOString() });
}
