import Link from "next/link";
import { Footer } from "./Footer";

const NAV: [string, string][] = [
  ["Map", "/"],
  ["King tide calendar", "/king-tides"],
  ["Stations", "/stations"],
  ["Spots", "/spots"],
  ["Methodology", "/methodology"],
];

/** Frame for every page outside the map. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5">
          <Link href="/" className="text-[19px] font-bold tracking-tight text-ink no-underline">
            Tideline
          </Link>
          <nav aria-label="Pages" className="flex flex-wrap gap-x-1 text-[15px]">
            {NAV.map(([label, href]) => (
              <Link key={href} href={href} className="flex min-h-11 items-center px-1.5 hover:text-link">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-14 pt-6">{children}</main>
      <Footer />
    </div>
  );
}

/** A labeled number: what the number is, the number with its unit, and its reference point. */
export function Stat({ label, value, note, testId }: { label: string; value: string; note?: string; testId?: string }) {
  return (
    <div className="panel px-3 py-2.5">
      <dt className="text-[14px] leading-tight text-muted">{label}</dt>
      <dd className="num mt-1 text-[24px] font-medium leading-tight" data-testid={testId}>
        {value}
      </dd>
      {note ? <dd className="mt-0.5 text-[13px] leading-snug text-muted">{note}</dd> : null}
    </div>
  );
}
