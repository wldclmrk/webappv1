/**
 * Renders trusted, server-built HTML. The wrapper uses display:contents so it adds no box,
 * keeping the Version A markup and CSS (sticky header, full-width sections) exactly as designed.
 */
export function Raw({ html }: { html: string }) {
  return <div className="raw" dangerouslySetInnerHTML={{ __html: html }} />;
}
