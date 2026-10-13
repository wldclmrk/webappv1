/** Formatting, escaping and URL helpers shared by every template. */
import { media, site } from './content';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.weldclass.com.au').replace(/\/$/, '');

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };

/** Escape text for HTML (also safe inside attribute values). */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]);
}

/** Escape a URL for an href/src attribute. */
export function escUrl(u: unknown): string {
  const s = String(u ?? '').trim();
  if (/^\s*javascript:/i.test(s)) return '';
  return esc(s.replace(/ /g, '%20'));
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', copy: '©', reg: '®', trade: '™', deg: '°', times: '×', frac12: '½', frac14: '¼', frac34: '¾', le: '≤', ge: '≥', plusmn: '±', bull: '•', eacute: 'é' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Strip tags and collapse whitespace (wcl_txt). */
export function txt(h: unknown): string {
  let s = String(h ?? '');
  s = s.replace(/<(script|style)[^>]*?>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '');
  s = decodeEntities(s);
  return s.replace(/\s+/g, ' ').trim();
}

/** Clip plain text to n characters on a word boundary, with an ellipsis. */
export function clip(s: unknown, n: number): string {
  const t = txt(s);
  const chars = Array.from(t);
  if (chars.length <= n) return t;
  const cut = chars.slice(0, n - 1).join('');
  const sp = cut.lastIndexOf(' ');
  return (sp > -1 ? cut.slice(0, sp) : cut) + '…';
}

/** Trim to a word boundary and append an ellipsis entity (returns escaped HTML). */
export function trimWordsAt(s: string, max: number, at: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return esc(s);
  const cut = chars.slice(0, at).join('');
  const sp = cut.lastIndexOf(' ');
  return esc(cut.slice(0, sp > -1 ? sp : at)) + '&hellip;';
}

export function slugify(s: unknown): string {
  let t = txt(s).toLowerCase();
  t = t.replace(/&[a-z]+;/g, '');
  t = t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return t.slice(0, 60);
}

export function money(n: number | string): string {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** One decimal place, like PHP number_format($x, 1). */
export function num1(n: unknown): string {
  const v = Number(n || 0);
  return (Math.round(v * 10 + (v >= 0 ? 1e-9 : -1e-9)) / 10).toFixed(1);
}

/** "7 October 2026" in the site's time zone. */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
}

/* ---------- Site copy (formerly the WordPress Customiser) ---------- */

export function mod(key: string): string {
  return site.mods[key] ?? '';
}

/* ---------- URLs ---------- */

const PAGE_SLUGS: Record<string, string> = {
  about: '/about/', contact: '/contact/', warranty: '/warranty/', catalogue: '/catalogue/', batch: '/batch/', careers: '/careers/',
  'where-to-buy': '/where-to-buy/', stockists: '/stockists/', 'handy-tools': '/handy-tools/', blog: '/blog/', search: '/search/',
  login: '/login/', forgot: '/forgot/', register: '/register/', home: '/', compare: '/compare/',
};

/** URL of a fixed page by key, with optional query args (null/undefined args are dropped). */
export function pageUrl(key: string, args?: Record<string, string | number | null | undefined>): string {
  const base = PAGE_SLUGS[key] ?? site.page_urls[key] ?? '/' + key + '/';
  if (!args) return base;
  const q = Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
  return q ? base + '?' + q : base;
}

/** Absolute URL for canonical links and structured data. */
export function abs(path: string): string {
  return /^https?:/.test(path) ? path : SITE_URL + path;
}

/** Relative links in copy ("/category/...") stay as they are. */
export function modUrl(key: string): string {
  return mod(key);
}

/* ---------- Images ---------- */

export function asset(file: string): string {
  return '/img/' + file.replace(/^\/+/, '');
}

const SIZE_FALLBACK: Record<string, string[]> = {
  thumbnail: ['thumbnail'],
  medium: ['medium'],
  medium_large: ['medium_large', 'large'],
  large: ['large'],
  woocommerce_thumbnail: ['woocommerce_thumbnail'],
  woocommerce_single: ['woocommerce_single'],
  full: [],
};

/** Resolve an image value: a media ID, a brand asset filename, or a URL. */
export function imgUrl(val: unknown, size = 'large'): string {
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
    const m = media[String(val)];
    if (!m || Number(val) <= 0) return '';
    for (const s of SIZE_FALLBACK[size] ?? [size]) {
      if (m.s[s]) return '/media/' + m.s[s][0];
    }
    return '/media/' + m.f;
  }
  if (val && typeof val === 'object' && 'media' in (val as Record<string, unknown>)) {
    return imgUrl((val as { media: number }).media, size);
  }
  if (typeof val === 'string' && val !== '') {
    return /^(https?:)?\/\//.test(val) || val.startsWith('/') ? val : asset(val);
  }
  return '';
}

/** srcset of same-proportion sizes, like WordPress. */
function srcset(id: number, size: string): string {
  const m = media[String(id)];
  if (!m) return '';
  const cur = m.s[size] ?? [m.f, m.w, m.h];
  const ratio = cur[1] && cur[2] ? cur[1] / cur[2] : 0;
  const seen = new Map<number, string>();
  const cands: MediaSizeLike[] = [...Object.values(m.s), [m.f, m.w, m.h]];
  for (const [f, w, h] of cands) {
    if (!w || !h || w > 2048) continue;
    if (ratio && Math.abs(w / h - ratio) > 0.02) continue;
    if (!seen.has(w)) seen.set(w, '/media/' + f + ' ' + w + 'w');
  }
  if (seen.size < 2) return '';
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(', ');
}
type MediaSizeLike = [string, number, number];

/** Plain <img> for a media ID or asset, matching the original markup. */
export function img(val: unknown, alt = '', extra = '', size = 'large'): string {
  const src = imgUrl(val, size);
  if (!src) return '';
  let ss = '';
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
    const s = srcset(Number(val), size);
    if (s) ss = ' srcset="' + esc(s) + '" sizes="(max-width: 760px) 100vw, 50vw"';
  }
  return '<img src="' + escUrl(src) + '"' + ss + ' alt="' + esc(alt) + '" loading="lazy" decoding="async"' + extra + '>';
}

/* ---------- Rich content ---------- */

/** Wrap tables in rich content with the scrolling .tbl container. */
export function wrapTables(html: string): string {
  return String(html).replace(/<table/gi, '<div class="tbl"><table').replace(/<\/table>/gi, '</table></div>');
}

/** Minimal port of WordPress wpautop(): blank lines become paragraphs, single newlines <br>. */
export function wpautop(text: string): string {
  let t = String(text ?? '');
  if (!t.trim()) return '';
  t = t.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n');
  t = t.replace(/\r\n?/g, '\n') + '\n';
  const blocks = '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary)';
  t = t.replace(new RegExp('(<' + blocks + '[\\s/>])', 'gi'), '\n\n$1');
  t = t.replace(new RegExp('(</' + blocks + '>)', 'gi'), '$1\n\n');
  t = t.replace(/\n\n+/g, '\n\n');
  const parts = t.split(/\n\s*\n/).filter((p) => p.trim() !== '');
  t = parts.map((p) => '<p>' + p.replace(/^\n+|\n+$/g, '') + '</p>\n').join('');
  t = t.replace(/<p>\s*<\/p>/g, '');
  t = t.replace(new RegExp('<p>\\s*(</?' + blocks + '[^>]*>)', 'gi'), '$1');
  t = t.replace(new RegExp('(</?' + blocks + '[^>]*>)\\s*</p>', 'gi'), '$1');
  t = t.replace(/<p>([^<]+)<\/(div|address|form)>/gi, '<p>$1</p></$2>');
  t = t.replace(/(?<!<br\s*\/?>)\s*\n(?!\s*<\/?(?:p|div|ul|ol|li|table|tr|td|th|h[1-6]|section|figure|blockquote))/gi, '<br />\n');
  t = t.replace(new RegExp('(</?' + blocks + '[^>]*>)\\s*<br />', 'gi'), '$1');
  t = t.replace(/<br \/>(\s*<\/?(?:p|li|div|dl|dd|dt|th|pre|td|ul|ol)[^>]*>)/gi, '$1');
  return t;
}

/** Run wpautop only on content without block-level markup. */
export function wpautopIfPlain(html: string): string {
  return /<(p|h[1-6]|ul|ol|table|div)\b/i.test(html) ? html : wpautop(html);
}
