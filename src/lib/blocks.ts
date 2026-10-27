/**
 * Reusable markup blocks (product cards, breadcrumbs, title bands, FAQs ...).
 * The markup matches the Version A design exactly, so the brand stylesheet applies unchanged.
 */
import { arr, posts, str, type Faq, type PostRecord, type Stockist } from './content';
import { comparesForTerm, p, prodsIn, subs, termUrl, topLabel, tops, type Term } from './catalogue';
import { icon, POST_ICONS } from './icons';
import { asset, esc, escUrl, fmtDate, img, imgUrl, mod, money, num1, pageUrl, paragraphsIfPlain, wrapTables } from './util';

export type Crumb = [string, string];

/** Breadcrumb trail: last item is the current page. */
export function crumbs(items: Crumb[]): string {
  return items
    .map((x, i) => (i === items.length - 1 ? '<b>' + esc(x[0]) + '</b>' : '<a href="' + escUrl(x[1]) + '">' + esc(x[0]) + '</a><span aria-hidden="true">/</span>'))
    .join('');
}

/** Photo title band with breadcrumbs. kick, title and intro are trusted HTML (escape before passing). */
export function band(image: unknown, crumbHtml: string, kick: string, title: string, intro = ''): string {
  return (
    '<section class="band"><img src="' + escUrl(imgUrl(image, 'full')) + '" alt=""><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb">' + crumbHtml + '</nav>' +
    '<div style="max-width:780px">' + (kick ? '<div class="kick or" style="margin-bottom:10px">' + kick + '</div>' : '') + '<h1>' + title + '<span class="dot">.</span></h1>' + (intro ? '<p>' + intro + '</p>' : '') + '</div></div></section>'
  );
}

/** Light breadcrumb bar used on product, article, search and login pages. */
export function crumbbar(items: Crumb[]): string {
  return '<div class="crumbbar"><div class="wrap"><nav class="crumbs lt" aria-label="Breadcrumb">' + crumbs(items) + '</nav></div></div>';
}

/** FAQ accordion (first item open). heading is trusted HTML. */
export function faqHtml(faq: Faq[], heading = '', id = 'faq', style = ''): string {
  if (!faq.length) return '';
  let h = '<div class="pfaq" id="' + esc(id) + '"' + (style ? ' style="' + esc(style) + '"' : '') + '>';
  if (heading) h += '<h2 class="disp">' + heading + '<span class="dot">.</span></h2>';
  faq.forEach((f, i) => {
    h += '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q ?? '') + '</summary><p>' + esc(f.a ?? '') + '</p></details>';
  });
  return h + '</div>';
}

/** Three support cards shown under category listings. */
export function helpStrip(): string {
  return (
    '<div class="grid g3" style="margin-top:40px">' +
    '<a class="card hov" href="' + pageUrl('warranty') + '" style="display:flex;gap:14px;align-items:center;padding:20px;color:var(--ink)"><img src="' + asset('badge-7yw-orange.png') + '" alt="" style="width:42px"><div><b style="color:var(--navy)">Warranty registration</b><div class="muted" style="font-size:14px">Register within 30 days for extended cover</div></div></a>' +
    '<a class="card hov" href="' + pageUrl('where-to-buy') + '" style="display:flex;gap:14px;align-items:center;padding:20px;color:var(--ink)"><span class="ic lt">' + icon('pin') + '</span><div><b style="color:var(--navy)">Where to buy</b><div class="muted" style="font-size:14px">1,000+ distributors across Australia</div></div></a>' +
    '<a class="card hov" href="' + pageUrl('handy-tools') + '" style="display:flex;gap:14px;align-items:center;padding:20px;color:var(--ink)"><span class="ic lt">' + icon('doc') + '</span><div><b style="color:var(--navy)">Handy tools</b><div class="muted" style="font-size:14px">Selection guides, charts and ID guides</div></div></a></div>'
  );
}

/** Machine selector promo banner. */
export function selectorBanner(mt = '36px'): string {
  return (
    '<div style="display:flex;flex-wrap:wrap;border-radius:8px;overflow:hidden;background:var(--blue) url(' + asset('l-tex-blue.jpg') + ') center/cover;color:#fff;margin-top:' + esc(mt) + '"><div style="flex:1 1 280px;min-height:240px;background:var(--navy)"><img src="' + asset('l-selector.jpg') + '" alt="Welder at the bench" style="width:100%;height:100%;object-fit:cover"></div>' +
    '<div style="flex:2 1 380px;padding:36px;display:flex;flex-direction:column;justify-content:center;gap:12px"><div class="kick or">Not sure which machine?</div><div class="disp" style="color:#fff;font-size:40px">Welding Machine Selector<span class="dot">.</span></div><p style="margin:0;color:var(--lav2)">Find the right welder or plasma cutter for the work you do.</p><div><a class="btn btn-o" href="' + pageUrl('handy-tools') + '">Start the selector</a></div></div></div>'
  );
}

/** Form field markup shared by the contact, dealer application and batch forms. */
export function field(id: string, label: string, type = 'text', req = false, full = false, name = ''): string {
  return '<div class="field' + (full ? ' full' : '') + '"><label for="' + esc(id) + '">' + esc(label) + (req ? ' *' : '') + '</label><input id="' + esc(id) + '" name="' + esc(name || id) + '" type="' + esc(type) + '"' + (req ? ' required' : '') + ' placeholder=" "></div>';
}

export const STATES: Record<string, string> = {
  NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania', ACT: 'Australian Capital Territory', NT: 'Northern Territory',
};

/** Blue stat band (values are trusted HTML). */
export function statBand(items: [string, string][]): string {
  return '<section class="statband"><div class="wrap">' + items.map((x) => '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('') + '</div></section>';
}

/** "More from Weldclass" tiles at the foot of content pages. */
export function moreFrom(curKey: string): string {
  const cards: [string, string, string, string][] = [
    ['About Weldclass', 'about', 'ph-helmet.jpg', 'Australian since 1979'],
    ['Where to buy', 'where-to-buy', 'l-wtb-band.jpg', '1,000+ distributors'],
    ['Warranty', 'warranty', 'ph-machine.jpg', 'Register within 30 days'],
    ['Handy tools', 'handy-tools', 'l-tools-band.jpg', 'Guides & charts'],
    ['Contact', 'contact', 'ph-jacket.jpg', mod('phone')],
    ['Careers', 'careers', 'ph-team.jpg', 'Join the team'],
    ['Batch certificates', 'batch', 'ph-sparks.jpg', 'Self-serve portal'],
    ['Knowledge & news', 'blog', 'band-blog.jpg', 'Weldclass Academy'],
  ];
  const list = cards.filter((c) => c[1] !== curKey).slice(0, 4);
  return (
    '<section class="sec tight mist"><div class="wrap"><div class="sec-head"><h2 style="font-size:34px">More from Weldclass<span class="dot">.</span></h2></div><div class="grid g4">' +
    list.map((c) => '<a class="tile" style="aspect-ratio:4/3" href="' + pageUrl(c[1]) + '"><img src="' + asset(c[2]) + '" alt="" loading="lazy"><div><b>' + esc(c[0]) + '</b><span>' + esc(c[3]) + '</span></div></a>').join('') +
    '</div></div></section>'
  );
}

/* ---------- Articles ---------- */

export function postCat(post: PostRecord): string {
  return post.cats?.[0]?.name ?? 'News';
}
export function readMinutes(post: PostRecord): number {
  const m = Number(post.meta.read_minutes) || 0;
  if (m) return m;
  const words = post.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Article image, or the branded "photo coming soon" placeholder. */
export function postImg(post: PostRecord): string {
  if (post.img) return img(post.img, post.title, '', 'large');
  const ph = str(post.meta.ph);
  return '<div class="bph" role="img" aria-label="' + esc(str(post.meta.hero_brief)) + '"><svg viewBox="0 0 64 64" width="76" height="76" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + (POST_ICONS[ph] ?? POST_ICONS.gauge) + '</svg><span>Photo coming soon</span></div>';
}

/** Blog article card. */
export function postCard(post: PostRecord, big = false, extraAttr = ''): string {
  const cat = postCat(post);
  const text = (post.title + ' ' + post.excerpt + ' ' + str(post.meta.primary_kw) + ' ' + arr<string>(post.meta.secondary_kw).join(' ')).toLowerCase();
  return (
    '<a class="card hov bcard' + (big ? ' big' : '') + '"' + extraAttr + ' href="' + escUrl(post.path) + '" data-bcat="' + esc(cat) + '" data-text="' + esc(text) + '"><div class="zoom bimg">' + postImg(post) + '<span class="tag or">' + esc(cat) + '</span></div><div class="bbody"><div class="bmeta">' + esc(fmtDate(post.date)) + ' &middot; ' + readMinutes(post) + ' min read</div><div class="disp bt">' + esc(post.title) + '</div><div class="muted bx">' + esc(post.excerpt) + '</div><div class="arrow" style="margin-top:auto;font-weight:600;color:var(--blue)">Read article</div></div></a>'
  );
}

export function latestPosts(n?: number): PostRecord[] {
  const list = [...posts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return n ? list.slice(0, n) : list;
}

/* ---------- Stockists ---------- */

/** Percent-encode like PHP rawurlencode (also encodes ! ' ( ) *). */
function rawUrlEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Store card used by Where to buy and Stockists. */
export function storeCard(d: Stockist): string {
  const maps = 'https://www.google.com/maps/search/?api=1&query=' + rawUrlEncode(d[0] + ' ' + d[1] + ' ' + d[2] + ' ' + d[3] + ' ' + d[4]);
  return (
    '<article class="store"><div style="min-width:0;flex:1"><div style="display:flex;justify-content:space-between;gap:10px"><h3 class="sname">' + esc(d[0]) + '</h3></div>' +
    '<p class="saddr">' + esc(d[1] + ', ' + d[2] + ' ' + d[3] + ' ' + d[4]) + '</p><div class="sact">' +
    (d[5] ? '<a class="btn btn-b btn-sm" href="tel:' + esc(d[5].replace(/[^\d+]/g, '')) + '">Call ' + esc(d[5]) + '</a>' : '') +
    '<a class="btn btn-l btn-sm" href="' + escUrl(maps) + '" target="_blank" rel="noopener">Directions</a>' +
    (d[8] ? '<a class="btn btn-l btn-sm" href="' + escUrl(d[8]) + '" target="_blank" rel="noopener">Website</a>' : '') +
    '</div></div></article>'
  );
}

/* ---------- Catalogue ---------- */

/** Product card (grid and list views). */
export function pcard(id: number, attr = ''): string {
  const x = p(id);
  if (!x) return '';
  const fp = x.from;
  const price = fp
    ? (x.prices.length > 1 ? '<small>RRP from</small>' : '<small>RRP incl. GST</small>') + money(fp)
    : '<small>Pricing</small><span style="font-size:15px">Ask a distributor</span>';
  const rate = x.rating && x.review_cnt >= 3 ? '<div class="prate"><b>' + num1(x.rating) + '</b>/10 <span>&middot; ' + x.review_cnt + ' reviews</span></div>' : '';
  return (
    '<article class="card hov pc"' + attr + ' data-series="' + esc(x.series) + '" data-name="' + esc(x.name.toLowerCase()) + '" data-price="' + esc(fp ? String(fp) : '') + '"><a class="pimg zoom" href="' + escUrl(x.url) + '">' + img(x.img, x.name, '', 'card') +
    '<span class="tags">' + (x.series ? '<span class="tag">' + esc(x.series) + '</span>' : '') + (x.pulse ? '<span class="tag or">Pulse</span>' : '') + '</span></a>' +
    '<div class="pbody"><a class="pname" href="' + escUrl(x.url) + '">' + esc(x.name) + '</a>' + rate + '<div class="pblurb">' + esc(x.summary ? x.summary : x.blurb) + '</div>' +
    '<div class="pfoot"><div class="price">' + price + '</div><a class="arrow" href="' + escUrl(x.url) + '" style="font-weight:600;font-size:14px">View</a></div></div></article>'
  );
}

/** Category sidebar tree. */
export function sideTree(curTop = 0, curSub = 0): string {
  let h = '<div class="tree"><div class="tree-h">Categories</div><div>';
  for (const t of tops()) {
    const open = Number(t.id) === Number(curTop);
    h += '<a class="top' + (open ? ' cur' : '') + '" href="' + escUrl(termUrl(t)) + '">' + esc(topLabel(t)) + '</a>';
    if (open) {
      h += '<div class="subs">';
      for (const s of subs(t)) {
        h += '<a href="' + escUrl(termUrl(s)) + '"' + (Number(s.id) === Number(curSub) ? ' class="cur" aria-current="page"' : '') + '>' + esc(s.name) + '</a>';
      }
      h += '</div>';
    }
  }
  return h + '</div></div>';
}

/** Mega menu panel for a top category (toggled by site.js). */
export function mega(t: Term): string {
  const label = topLabel(t);
  let h = '<div class="mega" id="mega-' + esc(t.slug) + '" role="region" aria-label="' + esc(label) + '" hidden><div><a href="' + escUrl(termUrl(t)) + '" class="kick">Shop all ' + esc(label) + ' &rarr;</a><h3>' + esc(label) + '<span class="dot">.</span></h3><div class="mega-grid">';
  for (const s of subs(t)) {
    const n = prodsIn(s).length;
    h += '<a href="' + escUrl(termUrl(s)) + '">' + (s.img ? img(s.img, '', '', 'thumbnail') : '') + '<span>' + esc(s.name) + '<br><small class="muted">' + n + ' products</small></span></a>';
  }
  h += '</div></div><a class="mega-feat" href="' + escUrl(termUrl(t)) + '"><img src="' + escUrl(imgUrl(t.tile)) + '" alt="" loading="lazy"><div><b>' + esc(label) + '</b><span>' + esc(t.sub) + '</span></div></a></div>';
  return h;
}

/** Category guide, FAQs and comparison links (bottom of category pages). */
export function catGuide(t: Term): string {
  const guide = str(t.meta.guide);
  const faq = arr<Faq>(t.meta.faq);
  const cmps = comparesForTerm(t);
  if (!guide && !faq.length && !cmps.length) return '';
  let h = '<section class="cguide">' + (guide ? '<div class="rich art">' + wrapTables(paragraphsIfPlain(guide)) + '</div>' : '');
  h += faqHtml(faq, esc((t.h1 ? t.h1 : t.name) + ' FAQs'));
  if (cmps.length) {
    h += '<div class="cmpstrip"><b>Compare models:</b> ';
    for (const c of cmps) h += '<a href="' + escUrl(c.path) + '">' + esc(c.title.split(':')[0]) + '</a>';
    h += '</div>';
  }
  return h + '</section>';
}
