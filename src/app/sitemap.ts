import type { MetadataRoute } from 'next';
import { allProductIds, allTerms, p } from '@/lib/catalogue';
import { compares, pages, posts, str } from '@/lib/content';
import { STATES } from '@/lib/blocks';
import { abs, pageUrl } from '@/lib/util';

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [{ url: abs('/'), changeFrequency: 'weekly', priority: 1 }];
  for (const id of allProductIds()) {
    const x = p(id)!;
    out.push({ url: abs(x.url), lastModified: x.rec.modified, priority: 0.8 });
  }
  for (const t of allTerms()) out.push({ url: abs(t.path), priority: t.parent ? 0.7 : 0.9 });
  for (const x of posts) out.push({ url: abs(x.path), lastModified: x.modified, priority: 0.6 });
  for (const x of pages) {
    const k = str(x.meta.page_key);
    if (!['home', 'search', 'login', 'forgot', 'register', ''].includes(k)) out.push({ url: abs(x.path), priority: 0.5 });
  }
  for (const s of Object.keys(STATES)) out.push({ url: abs(pageUrl('stockists') + s.toLowerCase() + '/'), priority: 0.4 });
  out.push({ url: abs(pageUrl('compare')), priority: 0.5 });
  for (const c of compares) out.push({ url: abs(c.path), lastModified: c.modified, priority: 0.6 });
  return out;
}
