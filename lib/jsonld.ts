/** JSON-LD for a script tag. Escapes "<" so data can never close the tag early. */
export function jsonLdHtml(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
