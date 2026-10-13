import { footer, header } from '@/lib/chrome';
import { jsonLd, type Seo } from '@/lib/seo';
import { Raw } from './Raw';

/** Page frame: header (with the current top category highlighted), main content, footer and JSON-LD. */
export function Shell({ html, curTop = 0, seo }: { html: string; curTop?: number; seo?: Seo }) {
  return (
    <>
      <Raw html={header(curTop)} />
      <main id="main">
        <Raw html={html} />
      </main>
      <Raw html={footer()} />
      {seo ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(seo) }} /> : null}
    </>
  );
}
