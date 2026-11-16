/** A plain phrase that carries its tide-science term in a tooltip, such as "average high tide" for MHHW. */
export function Term({ term, full, children }: { term: string; full: string; children: React.ReactNode }) {
  return (
    <span title={`${term}, ${full}`} className="cursor-help underline decoration-dotted decoration-1 underline-offset-2">
      {children}
    </span>
  );
}
