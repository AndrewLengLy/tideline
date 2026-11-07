import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageShell>
      <h1 className="text-[28px]">Page not found</h1>
      <p className="mt-3">
        That address has no page. The{" "}
        <Link className="text-link underline" href="/">
          map of San Francisco Bay
        </Link>{" "}
        is the place to start.
      </p>
    </PageShell>
  );
}
