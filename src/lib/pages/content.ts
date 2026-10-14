/** Articles, content pages, stockists, handy tools, search, dealer pages, comparisons and 404. */
import { arr, compares, pages, posts, stockists, str, type Faq, type PostRecord, type Stockist } from '../content';
import { allTerms, compareIds, p, primarySub, searchProducts, subs, termUrl, topLabel, topOf, tops } from '../catalogue';
import { band, crumbbar, crumbs, faqHtml, field, latestPosts, moreFrom, pcard, postCard, postCat, postImg, readMinutes, selectorBanner, statBand, STATES, storeCard, type Crumb } from '../blocks';
import { icon } from '../icons';
import { portalEnabled } from '../portal/session';
import { crumbLd, faqLd, seo, type Seo } from '../seo';
import { abs, asset, clip, esc, escUrl, fmtDate, img, imgUrl, mod, money, num1, pageUrl, slugify, txt, wrapTables } from '../util';

const home: Crumb = ['Home', '/'];

/* ---------- Forms ---------- */

/** Hidden fields for forms handled by /api/forms (type, return page, spam trap). */
function formHidden(type: string, back: string): string {
  return '<input type="hidden" name="form" value="' + esc(type) + '"><input type="hidden" name="back" value="' + esc(back) + '"><div aria-hidden="true" style="position:absolute;left:-9999px"><label>Leave blank <input type="text" name="website_url" tabindex="-1" autocomplete="off"></label></div>';
}

/** Success and error notices, revealed by site.js from ?sent= / ?formerr= after the form posts back. */
function formNotice(type: string): string {
  const msg = type === 'register' ? 'Thanks. Your application has been sent to the Weldclass team for review.' : 'Thanks. Our support team typically responds within 2-4 business hours.';
  return (
    '<div class="note" role="status" style="margin-top:20px" data-notice="sent" hidden><span><b>Sent.</b> ' + esc(msg) + '</span></div>' +
    '<div class="note" role="alert" style="margin-top:20px;background:#FFF4CC;color:#6B4E00" data-notice="formerr" hidden><span><b>Please check the form.</b> Some required fields were missing.</span></div>'
  );
}

/* ---------- Articles ---------- */

export function postBySlug(slug: string): PostRecord | null {
  return posts.find((x) => x.slug === slug) ?? null;
}

export function articleSeo(post: PostRecord): Seo {
  const m = post.meta;
  const d = str(m.meta_desc) || clip(post.excerpt, 155);
  const image = post.img ? imgUrl(post.img, 'large') : undefined;
  const kw = [str(m.primary_kw), ...arr<string>(m.secondary_kw)].filter(Boolean);
  const art: Record<string, unknown> = {
    '@type': 'Article', headline: post.title, description: d, datePublished: post.date.slice(0, 10), dateModified: post.modified.slice(0, 10),
    mainEntityOfPage: abs(post.path), keywords: kw.join(', '), author: { '@id': abs('/') + '#org' }, publisher: { '@id': abs('/') + '#org' },
  };
  if (image) art.image = abs(image);
  const graph: Record<string, unknown>[] = [art, crumbLd([['Home', '/'], ['Knowledge & News', pageUrl('blog')], [post.title, post.path]])];
  const f = arr<Faq>(m.faq);
  if (f.length) graph.push(faqLd(f));
  return seo({ t: str(m.meta_title) || post.title + ' | Weldclass', d, type: 'article', url: post.path, graph, ...(image ? { img: image } : {}) });
}

export function articleHtml(post: PostRecord): string {
  const catn = postCat(post);
  const mins = readMinutes(post);
  const toc: [string, string][] = [];
  let body = post.content.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs: string, inner: string) => {
    const sid = 'h-' + slugify(txt(inner));
    toc.push([sid, txt(inner)]);
    return '<h2 id="' + esc(sid) + '"' + attrs.replace(/\sid="[^"]*"/, '') + '>' + inner + '</h2>';
  });
  body = wrapTables(body);
  const take = arr<string>(post.meta.takeaways);
  const faq = arr<Faq>(post.meta.faq);
  const rel = arr<number>(post.meta.related).map(Number).filter((r) => !!p(r));

  let o = crumbbar([home, ['Knowledge & News', pageUrl('blog')], [post.title, '']]);
  o +=
    '<header class="phead"><div class="wrap phead-in"><div class="phead-txt"><div class="pmeta"><span class="tag or">' + esc(catn) + '</span><span>' + esc(fmtDate(post.date)) + '</span><span>' + mins + ' min read</span></div>' +
    '<h1 class="disp">' + esc(post.title) + '<span class="dot">.</span></h1><p class="plede">' + esc(post.excerpt) + '</p><div class="pby"><img src="' + asset('logo-blue.png') + '" alt=""><span>By the <b>Weldclass Academy</b> team, Tamworth NSW</span></div></div>' +
    '<div class="phead-img">' + postImg(post) + '</div></div></header>';
  o += '<section class="sec tight"><div class="wrap particle"><aside class="ptoc">';
  if (toc.length > 2) {
    o += '<div class="ptoc-in"><div class="kick">On this page</div><ol>' + toc.map((x) => '<li><button type="button" data-toc="' + esc(x[0]) + '">' + esc(x[1]) + '</button></li>').join('') + (faq.length ? '<li><button type="button" data-toc="faq">FAQs</button></li>' : '') + '</ol></div>';
  }
  o += '<div class="panel-tex"><div class="t">Find a distributor<span class="dot">.</span></div><p>Weldclass products are sold through trade distributors right across Australia.</p><a class="btn btn-o btn-sm" href="' + pageUrl('where-to-buy') + '">' + icon('pin') + ' Where to buy</a></div></aside><article class="pbody">';
  if (take.length) o += '<div class="ptake"><div class="kick or">Key takeaways</div><ul>' + take.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  o += '<div class="rich art">' + body + '</div>';
  if (faq.length) {
    o += '<section class="pfaq" id="faq"><h2 class="disp">Frequently asked questions<span class="dot">.</span></h2>' + faq.map((f, i) => '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>';
  }
  o += '<div class="pcta"><div><div class="disp" style="color:#fff;font-size:28px">Need a hand choosing<span class="dot">?</span></div><p>Talk to the Weldclass team, or find your nearest stockist.</p></div><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-o" href="' + pageUrl('where-to-buy') + '">' + icon('pin') + ' Where to buy</a><a class="btn btn-g" href="' + pageUrl('contact') + '">Contact us</a></div></div></article></div></section>';
  if (rel.length) {
    o += '<section class="sec tight" style="padding-top:0"><div class="wrap"><div class="sec-head"><h2 style="font-size:32px">Products in this article<span class="dot">.</span></h2></div><div class="grid g4">' + rel.slice(0, 4).map((r) => pcard(r)).join('') + '</div></div></section>';
  }
  const all = latestPosts().filter((x) => x.id !== post.id);
  const catId = post.cats?.[0]?.id;
  // Same-category articles; posts published at the same time are listed oldest entry first.
  const byDate = (a: PostRecord, b: PostRecord) => b.date.localeCompare(a.date) || a.id - b.id;
  let same = (catId ? all.filter((x) => x.cats.some((c) => c.id === catId)) : all).sort(byDate).slice(0, 3);
  if (same.length < 3) same = [...same, ...all.filter((x) => !same.includes(x)).slice(0, 3 - same.length)];
  o += '<section class="sec mist tight"><div class="wrap"><div class="sec-head"><h2 style="font-size:32px">Keep reading<span class="dot">.</span></h2><a class="arrow" href="' + pageUrl('blog') + '" style="font-weight:600">All articles</a></div><div class="grid g3">' + same.map((s) => postCard(s)).join('') + '</div></div></section>';
  return o;
}

/* ---------- Pages ---------- */

export function pageByKey(key: string): PostRecord | null {
  return pages.find((x) => str(x.meta.page_key) === key) ?? null;
}

const PAGE_SEO: Record<string, [string, string]> = {
  blog: ['Welding Guides, Charts & News | Weldclass', 'How-to guides, selection charts, maintenance schedules and news from Weldclass, Australian welding supplier since 1979.'],
  'where-to-buy': ['Where to Buy Weldclass | Find a Stockist Near You', 'Find your nearest Weldclass stockist. Over 1,100 trade and industrial supply stores across Australia and the South Pacific stock the Weldclass range.'],
  contact: ['Contact Weldclass | Tamworth NSW | 02 6764 9590', 'Contact the Weldclass team in Tamworth NSW on 02 6764 9590 for product advice, warranty support or help finding a distributor.'],
  about: ['About Weldclass | Australian Owned Since 1979', 'Weldclass is an Australian-owned welding supplier, based in Tamworth NSW since 1979, selling through more than 1,000 distributors.'],
  'handy-tools': ['Welding Guides, Charts & Selector Tools | Weldclass', 'Free welding machine selector, helmet, cover lens, MIG torch, TIG torch and electrode selection guides and charts from Weldclass.'],
  warranty: ['Weldclass Warranty & 7-Year Warranty Offer', 'How the Weldclass warranty works, which products qualify for the 7-year warranty offer and how to register online after purchase.'],
};

export function pageSeo(key: string, extra: Partial<Seo> = {}): Seo {
  const pg = pageByKey(key);
  const s = seo({ url: pageUrl(key) });
  if (PAGE_SEO[key]) [s.t, s.d] = PAGE_SEO[key];
  else if (pg && key !== 'home') {
    s.t = pg.title + ' | Weldclass';
    const ex = clip(pg.content, 155);
    if (ex) s.d = ex;
  }
  if (['search', 'login', 'forgot', 'register'].includes(key)) s.robots = 'noindex, follow';
  if (pg) {
    if (str(pg.meta.meta_title)) s.t = str(pg.meta.meta_title);
    if (str(pg.meta.meta_desc)) s.d = str(pg.meta.meta_desc);
  }
  return { ...s, ...extra };
}

/** Content page (About, Contact, Warranty, Batch certificates, Catalogue, Careers). */
export function contentPageHtml(pg: PostRecord): string {
  const key = str(pg.meta.page_key);
  const title = pg.title.replace(/ Welding Products Australia/, '');
  const bandImg = str(pg.meta.band) || 'band-about.jpg';
  const kick = str(pg.meta.kick);
  const ph1 = str(pg.meta.photo1) || 'ph-weld.jpg';
  const ph2 = str(pg.meta.photo2) || 'ph-helmet.jpg';
  let o = band(bandImg, crumbs([home, [title, '']]), esc(kick), esc(title));
  if (key === 'about') {
    o += statBand([['1979', 'Founded in Tamworth, NSW'], ['1,000+', 'Distributors across Australia &amp; the South Pacific'], ['3', 'Warehouses: Tamworth, Sydney &amp; Perth'], ['7-year', 'Warranty offer on selected machines*']]);
  } else if (key === 'contact') {
    o += statBand([[esc(mod('phone')), 'International +61 2 6764 9590'], ['2-4 hrs', 'Typical support response, business days'], ['Tamworth', 'Head office: 6 East West Place, NSW 2340'], ['Sydney &amp; Perth', 'Warehouses: Lidcombe NSW &amp; Welshpool WA']]);
  }
  let content = pg.content.replace(/<p>\s*(Open [^<]*|click here[^<]*)\s*<\/p>/gi, '');
  content = content.replace(/\s(click here|here)\s*\./gi, '.');
  let extra = '';
  if (key === 'contact') {
    extra +=
      formNotice('contact') +
      '<form class="card" style="padding:26px;margin-top:28px" method="post" action="/api/forms/">' + formHidden('contact', pg.path) + '<div class="disp" style="font-size:28px;margin-bottom:14px">Send us a message<span class="dot">.</span></div><div class="form">' +
      field('c-fn', 'First name', 'text', true, false, 'first_name') + field('c-ln', 'Last name', 'text', true, false, 'last_name') + field('c-bn', 'Business name', 'text', false, false, 'business') + field('c-em', 'Email address', 'email', true, false, 'email') + field('c-ph', 'Phone', 'tel', false, false, 'phone') + field('c-pc', 'Postcode', 'text', true, false, 'postcode') +
      '<div class="field full"><label for="c-msg">Enquiry / comments *</label><textarea id="c-msg" name="message" required></textarea></div></div><button class="btn btn-o" style="margin-top:16px" type="submit">Send enquiry</button></form>';
  } else if (key === 'warranty') {
    extra += '<div class="grid g2" style="margin-top:28px"><div class="panel-tex" style="padding:28px"><img src="' + asset('badge-7yw-orange.png') + '" alt="" style="width:64px;margin-bottom:12px"><div class="t" style="font-size:28px">Register your warranty<span class="dot">.</span></div><p>Registration within 30 days of purchase is required to qualify for extended warranty.</p><a class="btn btn-o" href="' + escUrl(mod('warranty_form')) + '" target="_blank" rel="noopener">Open registration form</a></div><div style="border-radius:8px;padding:28px;background:var(--mist)"><div class="disp" style="font-size:28px;margin-bottom:10px">Monthly prize draw<span class="dot">.</span></div><p class="muted">Every registration goes into the monthly draw to win a free welding helmet or jacket.</p></div></div>';
  } else if (key === 'batch') {
    extra += formNotice('batch') + '<form class="card" style="padding:26px;margin-top:28px" method="post" action="/api/forms/">' + formHidden('batch', pg.path) + '<div class="disp" style="font-size:28px;margin-bottom:14px">Find a certificate<span class="dot">.</span></div><div class="form">' + field('b-pn', 'Part number', 'text', true, false, 'part_number') + field('b-bn', 'Batch / lot number', 'text', true, false, 'batch') + field('b-em', 'Email address', 'email', true, false, 'email') + '</div><button class="btn btn-o" style="margin-top:16px" type="submit">Search certificates</button></form>';
  }
  o += '<section class="sec tight"><div class="wrap cp"><div class="cp-text"><div class="rich">' + content + '</div>' + extra + '</div>';
  o += '<div class="cp-photos"><img src="' + escUrl(imgUrl(ph1, 'large')) + '" alt="" class="big"><img src="' + escUrl(imgUrl(ph2, 'large')) + '" alt="" class="small"><div class="panel-tex"><div class="t">Talk to us<span class="dot">.</span></div><p>Phone ' + esc(mod('phone')) + '<br>' + esc(mod('address')) + '</p><a class="btn btn-o btn-sm" href="' + pageUrl('contact') + '">Contact Weldclass</a></div></div></div></section>';
  if (key === 'about') {
    o += '<section class="mosaic"><img src="' + asset('ph-weld.jpg') + '" alt="Welding in a Weldclass helmet" loading="lazy"><img src="' + asset('ph-machine.jpg') + '" alt="Weldclass FORCE machine" loading="lazy"><img src="' + asset('ph-pd30.jpg') + '" alt="ALLCLEAR PD30 fume monitor" loading="lazy"><img src="' + asset('ph-papr-ctrl.jpg') + '" alt="PROMAX 720R respirator" loading="lazy"><img src="' + asset('ph-table-ctrl.jpg') + '" alt="Downdraft table controls" loading="lazy"></section>';
  }
  return o + moreFrom(key);
}

/* ---------- Blog index ---------- */

export function blogHtml(): string {
  const pg = pageByKey('blog');
  const all = latestPosts();
  const cats = ['All', 'How-to guides', 'Selection charts', 'Fume control', 'Maintenance', 'Safety', 'News'];
  const count: Record<string, number> = { All: all.length };
  for (const po of all) {
    const c = postCat(po);
    count[c] = (count[c] ?? 0) + 1;
    if (!cats.includes(c)) cats.push(c);
  }
  const rest = [...all];
  const feat = rest.shift();
  let o = band(str(pg?.meta.band) || 'band-blog.jpg', crumbs([home, ['Knowledge & News', '']]), 'Weldclass Academy', 'Knowledge &amp; news', 'How-to guides, selection charts, maintenance schedules and news from the Weldclass team in Tamworth.');
  o += '<section class="sec tight"><div class="wrap" data-blog><div class="toolbar" style="flex-wrap:wrap"><div role="group" aria-label="Filter by topic" style="display:flex;flex-wrap:wrap;gap:8px;flex:1 1 520px">';
  for (const c of cats) {
    if (count[c]) o += '<button type="button" class="chip" data-bcatf="' + esc(c) + '" aria-pressed="' + (c === 'All' ? 'true' : 'false') + '">' + esc(c) + '<small>' + count[c] + '</small></button>';
  }
  o += '</div><div class="field" style="flex:0 1 320px"><label class="sr" for="bq">Search articles</label><input id="bq" data-blogq placeholder="Search articles"></div></div>';
  if (feat) o += '<div class="bfeat" data-bfeat>' + postCard(feat, true) + '</div>';
  o += '<div class="sec-head" style="margin:8px 0 18px"><h2 style="font-size:30px" data-btitle>Latest articles<span class="dot">.</span></h2><span class="muted" id="bcount">' + rest.length + ' article' + (rest.length === 1 ? '' : 's') + '</span></div><div class="grid g3" id="bloglist">';
  if (feat) o += postCard(feat, false, ' hidden data-featdup');
  o += rest.map((po) => postCard(po)).join('');
  o += '</div><p class="muted" id="bnone" hidden>No articles match that search.</p></div></section>';
  return o;
}

/* ---------- Handy tools ---------- */

export function handyToolsHtml(): string {
  const pg = pageByKey('handy-tools');
  const byLegacy = (id: number) => {
    const po = posts.find((x) => str(x.meta.legacy_id) === String(id));
    return po ? po.path : 'https://www.weldclass.com.au/blog/' + id;
  };
  const cat = (slug: string) => {
    const t = allTerms().find((x) => x.slug === slug);
    return t ? termUrl(t) : '/';
  };
  const tools: [string, string, string, string, string][] = [
    ['Machines', 'Web tool', 'Welding Machine Selector', 'machine', byLegacy(134)],
    ['Machines', 'Guide', 'Welding Fume Extractor Selection Guide', 'fume', byLegacy(147)],
    ['Safety', 'Guide', 'Welding Helmet Selection Guide', 'helmet', cat('welding-helmets')],
    ['Safety', 'Web tool', 'Find the Right Clear Cover Lens', 'lens', cat('helmet-lenses')],
    ['Safety', 'Guide', 'PAPR Welding Helmet Guide', 'papr', cat('welding-helmets')],
    ['Safety', 'Chart', 'Welding Blanket Selection Chart', 'blanket', cat('welding-blankets')],
    ['Torches', 'Guide', 'MIG Torch ID & Selection Guide', 'migid', cat('torches')],
    ['Torches', 'Guide', 'TIG Torch Selection Guide', 'tig', byLegacy(76)],
    ['Torches', 'Guide', 'Parts Box Kits for MIG, TIG & Plasma Torches', 'partskits', byLegacy(116)],
    ['Consumables', 'Chart', 'Stick Welding Electrode Selection Chart', 'stick', byLegacy(130)],
    ['Consumables', 'Chart', 'Oxy Brazing Rod & TIG Filler Wire Chart', 'brazing', byLegacy(81)],
    ['Consumables', 'Guide', 'Hardfacing Selection Guide', 'hardfacing', cat('hardfacing-wire')],
    ['Consumables', 'Guide', 'Aluminium MIG Wire Selection Guide', 'alu', cat('mig-wire-aluminium')],
    ['Oxy & Gas Gear', 'Guide', 'Oxy Equipment Identification Reference Guide', 'oxy', byLegacy(120)],
  ];
  const topics = ['all', 'Machines', 'Safety', 'Torches', 'Consumables', 'Oxy & Gas Gear'];
  let o = band(str(pg?.meta.band) || 'l-tools-band.jpg', crumbs([home, ['Handy Tools', '']]), 'Guides &middot; Charts &middot; Web tools', 'Handy tools', 'Click through to some of our most popular guides and web tools. You can also browse Weldclass Blog (Knowledge &amp; News) articles.');
  o += '<section class="sec tight"><div class="wrap" data-tools>' + selectorBanner('0');
  const extra = (pg?.content ?? '').trim();
  if (extra) o += '<div class="rich" style="margin-top:32px">' + extra + '</div>';
  o += '<div class="sec-head" style="margin-top:52px"><h2>Guides &amp; charts<span class="dot">.</span></h2><div style="display:flex;flex-wrap:wrap;gap:8px" role="group" aria-label="Filter by topic">';
  for (const t of topics) {
    const n = t === 'all' ? tools.length : tools.filter((x) => x[0] === t).length;
    o += '<button type="button" class="chip" data-ht="' + esc(t) + '" aria-pressed="' + (t === 'all' ? 'true' : 'false') + '">' + esc(t === 'all' ? 'All' : t) + '<small>(' + n + ')</small></button>';
  }
  o += '</div></div><div class="grid tools">';
  for (const x of tools) {
    const ext = /^https?:/.test(x[4]);
    o += '<a class="card hov toolcard" data-topic="' + esc(x[0]) + '" href="' + escUrl(x[4]) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '><span class="zoom" style="display:block;aspect-ratio:5/2;background:var(--navy)"><img src="' + asset('tool-' + x[3] + '.jpg') + '" alt="' + esc(x[2]) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover"></span><span class="tc-foot"><span class="tag lt">' + esc(x[1]) + '</span><span class="tc-name">' + esc(x[2]) + '</span><span class="arrow" style="font-weight:600;color:var(--blue);white-space:nowrap">Open</span></span></a>';
  }
  o += '</div><div style="margin-top:40px;display:flex;flex-wrap:wrap;gap:16px 24px;justify-content:space-between;align-items:center;border-radius:8px;background:var(--mist);padding:24px 28px"><div><div class="disp" style="font-size:26px">Still got a question<span class="dot">?</span></div><div class="muted">Browse Weldclass Academy articles, FAQs and how-to videos.</div></div><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-b" href="' + pageUrl('blog') + '">FAQs &amp; blogs</a><a class="btn btn-l" href="' + pageUrl('contact') + '">Contact Weldclass</a></div></div></div></section>';
  return o;
}

/* ---------- Stockists ---------- */

export function stockistsHtml(st = ''): string {
  const pg = pageByKey('stockists');
  const all = stockists as Stockist[];
  const bandImg = str(pg?.meta.band) || 'l-wtb-band.jpg';
  const wtb: Crumb = ['Where to buy', pageUrl('where-to-buy')];
  let o = '';
  if (!STATES[st]) {
    const cnt: Record<string, number> = {};
    for (const d of all) {
      const k = STATES[d[3]] ? d[3] : 'PAC';
      cnt[k] = (cnt[k] ?? 0) + 1;
    }
    o += band(bandImg, crumbs([home, wtb, ['Stockists by state', '']]), all.length.toLocaleString('en-AU') + ' locations', 'Weldclass stockists', 'Every trade and industrial store that stocks Weldclass, listed by state and town.');
    o += '<section class="sec tight"><div class="wrap"><div class="grid g4">';
    for (const [k, name] of Object.entries(STATES)) {
      o += '<a class="card hov stcard" href="' + pageUrl('stockists') + k.toLowerCase() + '/"><b>' + esc(name) + '</b><span>' + (cnt[k] ?? 0) + ' stockists</span></a>';
    }
    o += '</div>' + (cnt.PAC ? '<p class="muted" style="margin-top:18px">Plus ' + cnt.PAC + ' distributors in Fiji, New Caledonia, Papua New Guinea, Samoa and Vanuatu. <a href="' + pageUrl('contact') + '">Contact us</a> for details.</p>' : '') + '</div></section>';
    return o;
  }
  const list = all.filter((d) => d[3] === st);
  const towns = new Map<string, Stockist[]>();
  for (const d of list) {
    const t = (d[2] ? d[2] : 'Other').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    if (!towns.has(t)) towns.set(t, []);
    towns.get(t)!.push(d);
  }
  const sorted = [...towns.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const name = STATES[st];
  o += band(bandImg, crumbs([home, wtb, ['Stockists', pageUrl('stockists')], [name, '']]), list.length + ' stockists in ' + sorted.length + ' towns', 'Weldclass stockists in ' + esc(name), 'Weldclass welders, consumables and safety gear are stocked by ' + list.length + ' trade and industrial stores across ' + esc(name) + '. Call ahead to check stock of the product you need.');
  o += '<section class="sec tight"><div class="wrap"><nav class="townnav" aria-label="Towns">';
  for (const [t, ds] of sorted) o += '<a href="#town-' + esc(slugify(t)) + '">' + esc(t) + ' <small>' + ds.length + '</small></a>';
  o += '</nav>';
  for (const [t, ds] of sorted) o += '<section class="town" id="town-' + esc(slugify(t)) + '"><h2 class="disp">' + esc(t) + '<span class="dot">.</span></h2><div class="grid g3">' + ds.map(storeCard).join('') + '</div></section>';
  return o + '</div></section>';
}

export function stockistsSeo(st = ''): Seo {
  const sn = STATES[st] ?? '';
  const s = pageSeo('stockists', {
    t: sn ? 'Weldclass Stockists in ' + sn + ' | Where to Buy' : 'Weldclass Stockists by State | Where to Buy',
    d: sn ? 'Every Weldclass stockist in ' + sn + ', listed by town with address, phone and directions. Call ahead to check stock.' : 'Browse every Weldclass stockist in Australia by state and town, with address, phone and directions.',
  });
  if (sn) {
    s.url = pageUrl('stockists') + st.toLowerCase() + '/';
    const list = (stockists as Stockist[]).filter((x) => x[3] === st).slice(0, 100).map((x, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Store', name: x[0], ...(x[5] ? { telephone: x[5] } : {}), address: { '@type': 'PostalAddress', streetAddress: x[1], addressLocality: x[2], addressRegion: x[3], postalCode: x[4], addressCountry: 'AU' } },
    }));
    s.graph.push({ '@type': 'ItemList', name: 'Weldclass stockists in ' + sn, itemListElement: list });
  }
  return s;
}

/* ---------- Where to buy ---------- */

export function whereToBuyHtml(productId = 0, q = 'Tamworth NSW 2340'): string {
  const pg = pageByKey('where-to-buy');
  const pr = productId ? p(productId) : null;
  const cr: Crumb[] = [home];
  if (pr) cr.push([pr.name, pr.url]);
  cr.push(['Where to buy', '']);
  let o = band(str(pg?.meta.band) || 'l-wtb-band.jpg', crumbs(cr), stockists.length.toLocaleString('en-AU') + ' distributors across Australia &amp; the South Pacific', pr ? 'Where to buy ' + esc(pr.name) : 'Where to buy Weldclass', 'Weldclass welding machines and consumables are sold through trade and industrial supply stores. Enter your postcode or suburb to find the nearest stockists, then call ahead to check stock.');
  if (pr) {
    o +=
      '<section class="crumbbar"><div class="wrap" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px">' + img(pr.img, pr.name, ' style="width:72px;height:72px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:6px;padding:4px"', 'thumbnail') +
      '<div style="flex:1 1 300px;min-width:0"><div class="kick">You are looking for</div><div style="font-weight:700;color:var(--navy);font-size:17px">' + esc(pr.name) + '</div>' + (pr.from ? '<div class="muted" style="font-size:14px">' + (pr.prices.length > 1 ? 'RRP from ' : 'RRP ') + money(pr.from) + ' incl. GST</div>' : '') + '</div>' +
      '<p class="muted" style="margin:0;flex:1 1 280px;font-size:14px">Stock varies by store. Call ahead with the part number to check availability.</p><a class="arrow" href="' + escUrl(pr.url) + '" style="font-weight:600">Back to product</a></div></section>';
  }
  o += '<section class="sec tight"><div class="wrap" data-wtb data-q="' + esc(q) + '" data-r="25"><form data-act="wtbform" class="card" style="display:flex;flex-wrap:wrap;gap:14px 18px;align-items:flex-end;padding:20px;margin-bottom:24px;box-shadow:0 10px 30px rgba(21,22,64,.06)"><div class="field" style="flex:1 1 300px"><label for="wq">Postcode or suburb</label><input id="wq" name="pc" inputmode="text" value="' + esc(q) + '"></div>' +
    '<div class="field"><span style="font-weight:600;font-size:14px;color:var(--navy)">Distance</span><div style="display:flex;flex-wrap:wrap;gap:6px" role="group" aria-label="Search radius">';
  for (const r of [10, 25, 50, 100, 250]) o += '<button type="button" class="chip" style="border-radius:4px;min-height:48px" data-rad="' + r + '" aria-pressed="' + (r === 25 ? 'true' : 'false') + '">' + r + ' km</button>';
  o += '</div></div><button class="btn btn-o" type="submit" style="min-height:48px">Search</button></form>' +
    '<div data-wtb-out><div class="empty">Loading distributors&hellip;</div></div>' +
    '<p style="margin-top:22px"><a class="arrow" href="' + pageUrl('stockists') + '" style="font-weight:600">Browse all stockists by state</a></p></div></section>';
  o += '<section class="sec tight" style="padding-top:0"><div class="wrap grid g2"><div class="panel-tex" style="padding:32px"><div class="t" style="font-size:32px">Can\'t find what you need<span class="dot">?</span></div><p>Tell us what you are looking for and we will point you to a distributor that can help. Phone ' + esc(mod('phone')) + '.</p><a class="btn btn-o" href="' + pageUrl('contact') + '">Contact Weldclass</a></div>' +
    '<div style="border-radius:8px;padding:32px;background:var(--mist)"><div class="disp" style="font-size:32px;margin-bottom:10px">Become a distributor<span class="dot">.</span></div><p class="muted">Retail, distribution and industrial supply businesses can apply to stock the Weldclass range.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-b" href="' + pageUrl('register') + '">Apply now</a><a class="btn btn-l" href="' + pageUrl('login') + '">Dealer login</a></div></div></div></section>';
  return o;
}

/* ---------- Search ---------- */

export function searchHtml(qRaw: string, fcat: string, pageNum: number): string {
  const q = qRaw.trim();
  const ql = q.toLowerCase();
  const words = ql.split(/\s+/).filter(Boolean);
  const res = searchProducts(ql);
  const byTop = new Map<string, number[]>();
  for (const id of res) {
    const sb = primarySub(id);
    const tp = sb ? topOf(sb) : null;
    const k = tp ? tp.slug : 'other';
    if (!byTop.has(k)) byTop.set(k, []);
    byTop.get(k)!.push(id);
  }
  const list = fcat === 'all' ? res : byTop.get(fcat) ?? [];
  const per = 24;
  const pagesN = Math.max(1, Math.ceil(list.length / per));
  const page = Math.min(Math.max(1, pageNum), pagesN);
  const shown = list.slice((page - 1) * per, page * per);
  const cats = words.length ? tops().flatMap((t) => subs(t)).filter((s) => words.every((w) => s.name.toLowerCase().includes(w))) : [];
  const arts = words.length ? latestPosts().filter((po) => words.every((w) => (po.title + ' ' + po.excerpt).toLowerCase().includes(w))) : [];
  const title = q ? (ql === 'new' ? 'Latest products' : 'Results for &ldquo;' + esc(q) + '&rdquo;') : 'All products';
  const url = (args: Record<string, string | number | null>) => esc(pageUrl('search', { q, ...args }));

  let o = crumbbar([home, ['Search', '']]);
  o +=
    '<section class="sec tight"><div class="wrap"><div class="sec-head" style="margin-bottom:16px"><div><div class="kick">' + res.length + ' products' + (cats.length ? ' &middot; ' + cats.length + ' categories' : '') + (arts.length ? ' &middot; ' + arts.length + ' articles' : '') + '</div><h1 class="disp" style="font-size:clamp(32px,4vw,48px);margin-top:6px">' + title + '<span class="dot">.</span></h1></div>' +
    '<form class="srchf" action="' + pageUrl('search') + '" method="get"><label class="sr" for="sq">Search again</label><input id="sq" name="q" value="' + esc(q) + '" placeholder="Search products or part numbers" style="flex:1;height:46px;border:1px solid var(--line2);border-radius:4px 0 0 4px;padding:0 14px;font:inherit;min-width:0"><button class="btn btn-b" style="border-radius:0 4px 4px 0">Search</button></form></div>';
  if (byTop.size > 1) {
    o += '<div role="group" aria-label="Filter by category" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"><a class="chip" href="' + url({}) + '" aria-pressed="' + (fcat === 'all' ? 'true' : 'false') + '">All<small>' + res.length + '</small></a>';
    for (const t of tops()) {
      const n = byTop.get(t.slug)?.length;
      if (n) o += '<a class="chip" href="' + url({ cat: t.slug }) + '" aria-pressed="' + (fcat === t.slug ? 'true' : 'false') + '">' + esc(topLabel(t)) + '<small>' + n + '</small></a>';
    }
    o += '</div>';
  }
  if (cats.length) {
    o += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;align-items:center"><span class="muted" style="font-size:14px">Matching categories:</span>' + cats.map((s) => '<a class="chip" href="' + escUrl(termUrl(s)) + '">' + esc(s.name) + '</a>').join('') + '</div>';
  }
  if (list.length) {
    o += '<div class="grid g4">' + shown.map((id) => pcard(id)).join('') + '</div>';
    if (pagesN > 1) {
      o += '<nav class="pager" aria-label="Results pages">';
      for (let i = 1; i <= pagesN; i++) o += '<a class="pgb" href="' + url({ cat: fcat === 'all' ? null : fcat, pg: i }) + '" aria-current="' + (page === i ? 'page' : 'false') + '">' + i + '</a>';
      o += '<span class="muted">Showing ' + ((page - 1) * per + 1) + '-' + Math.min(page * per, list.length) + ' of ' + list.length + '</span></nav>';
    }
  } else {
    o += '<div class="empty"><div class="disp" style="font-size:28px">No products match &ldquo;' + esc(q) + '&rdquo;</div><p>Try a part number (e.g. WF-06128), a product name or a category like &ldquo;gloves&rdquo;.</p><a class="btn btn-b" href="' + pageUrl('contact') + '">Ask Weldclass</a></div>';
  }
  if (arts.length) o += '<div class="sec-head" style="margin-top:48px"><h2 style="font-size:32px">Articles<span class="dot">.</span></h2></div><div class="grid g3">' + arts.slice(0, 3).map((po) => postCard(po)).join('') + '</div>';
  return o + '</div></section>';
}

/* ---------- Dealer login, reset password, apply for a login ---------- */

export const DEALER_TITLES: Record<string, string> = { login: 'Dealer login', forgot: 'Reset password', register: 'Apply for a login', set: 'Set your password' };

const spamTrap = '<div aria-hidden="true" style="position:absolute;left:-9999px"><label>Leave blank <input type="text" name="website_url" tabindex="-1" autocomplete="off"></label></div>';

export function dealerHtml(mode: 'login' | 'forgot' | 'register' | 'set', token = ''): string {
  const portal = process.env.NEXT_PUBLIC_DEALER_LOGIN_URL || '';
  const phone = esc(mod('phone'));
  const n = (key: string, text: string, alert = false) =>
    '<div class="note" role="' + (alert ? 'alert' : 'status') + '" data-notice="' + key + '" hidden' + (alert ? ' style="background:#FFF4CC;color:#6B4E00"' : '') + '><span>' + text + '</span></div>';
  let body = '';
  if (mode === 'login' && portalEnabled()) {
    body =
      '<p style="margin:0" class="muted">Login is available only for authorised Weldclass Distributors &amp; partners.</p>' +
      n('bad', '<b>Incorrect username or password.</b> Check them and try again, or <a href="' + pageUrl('forgot') + '">reset your password</a>.', true) +
      n('locked', '<b>Too many attempts.</b> This account is locked for 15 minutes. <a href="' + pageUrl('forgot') + '">Reset your password</a> to unlock it now.', true) +
      n('inactive', '<b>This login is not linked to an active Weldclass account.</b> Call ' + phone + ' and we&rsquo;ll sort it out.', true) +
      n('expired', '<b>Your session has ended.</b> Please log in again.', true) +
      n('out', '<b>You&rsquo;re logged out.</b>') +
      n('formerr', '<b>Something went wrong.</b> Please try again, or call ' + phone + '.', true) +
      '<form class="form" method="post" action="/api/portal/signin/" style="grid-template-columns:1fr">' + spamTrap +
      '<div class="field full"><label for="d-login">Username or email address *</label><input id="d-login" name="login" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false"></div>' +
      '<div class="field full"><label for="d-pw">Password *</label><input id="d-pw" name="password" type="password" required autocomplete="current-password"></div>' +
      '<button class="btn btn-o field full" type="submit">Log in</button></form>' +
      '<p style="margin:0;font-size:14px"><a href="' + pageUrl('forgot') + '" style="font-weight:600">Forgot your password, or logging in for the first time?</a></p>';
  } else if (mode === 'forgot' && portalEnabled()) {
    body =
      '<p style="margin:0" class="muted">First time here, or forgotten your password? Enter the email address on your Weldclass account and we&rsquo;ll email you a link to set a new password.</p>' +
      n('sent', '<b>Check your inbox.</b> If that email is on a Weldclass dealer account, a link is on its way. It works once, for 30 minutes.') +
      n('expired', '<b>That link has expired or has already been used.</b> Enter your email for a new one.', true) +
      n('formerr', '<b>Something went wrong.</b> Check the email address and try again, or call ' + phone + '.', true) +
      '<form class="form" method="post" action="/api/portal/reset/" style="grid-template-columns:1fr">' + spamTrap +
      '<div class="field full"><label for="d-em">Email address *</label><input id="d-em" name="email" type="email" required autocomplete="email" inputmode="email"></div>' +
      '<button class="btn btn-o field full" type="submit">Email me a link</button></form>';
  } else if (mode === 'set') {
    body =
      '<p style="margin:0" class="muted">Choose a password with at least 10 characters. A short phrase is easier to remember than a jumble of symbols.</p>' +
      n('short', '<b>That password is too short.</b> Use at least 10 characters.', true) +
      n('long', '<b>That password is too long.</b> Use 200 characters or fewer.', true) +
      n('mismatch', '<b>The two passwords don&rsquo;t match.</b> Please type them again.', true) +
      n('formerr', '<b>Something went wrong saving your password.</b> Please try again, or call ' + phone + '.', true) +
      '<form class="form" method="post" action="/api/portal/set-password/" style="grid-template-columns:1fr"><input type="hidden" name="t" value="' + esc(token) + '">' +
      '<div class="field full"><label for="d-pw1">New password *</label><input id="d-pw1" name="password" type="password" required minlength="10" autocomplete="new-password"></div>' +
      '<div class="field full"><label for="d-pw2">Type it again *</label><input id="d-pw2" name="password2" type="password" required minlength="10" autocomplete="new-password"></div>' +
      '<button class="btn btn-o field full" type="submit">Save password and log in</button></form>';
  } else if (mode === 'login' || mode === 'forgot') {
    body = portal
      ? '<p style="margin:0" class="muted">' + (mode === 'login' ? 'Login is available only for authorised Weldclass Distributors &amp; partners.' : 'Password resets are handled in the dealer portal.') + '</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-o" href="' + escUrl(portal) + '">Go to the dealer portal</a></div>'
      : '<p style="margin:0" class="muted">' + (mode === 'login' ? 'Login is available only for authorised Weldclass Distributors &amp; partners.' : 'Dealer passwords are reset through the dealer portal.') + '</p><div class="note" role="status"><span><b>Dealer login is moving.</b> While our new dealer portal is set up, call ' + phone + ' or <a href="' + pageUrl('contact') + '">contact us</a> for invoices, statements and account help.</span></div>';
  }
  if (mode === 'login' || mode === 'forgot') {
    if (mode === 'login') {
      body +=
        '<div style="border-top:1px solid var(--line);padding-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px"><div><b style="color:var(--navy)">Need a login?</b><div class="muted" style="font-size:14px;margin:4px 0 6px">Authorised distributors and partners can apply for access.</div><a class="arrow" href="' + pageUrl('register') + '" style="font-weight:600">Register / apply for a login</a></div><div><b style="color:var(--navy)">Want to stock Weldclass?</b><div class="muted" style="font-size:14px;margin:4px 0 6px">Tell us about your business.</div><a class="arrow" href="' + pageUrl('register') + '" style="font-weight:600">Apply to become a distributor</a></div></div>' +
        '<a href="' + pageUrl('where-to-buy') + '" class="note" style="color:var(--navy)"><span class="ic">' + icon('pin') + '</span><span><b>Looking to buy Weldclass products?</b><br><span class="muted">Find your nearest distributor</span></span></a>';
    } else {
      body += '<a class="arrow" href="' + pageUrl('login') + '" style="font-weight:600">Back to login</a>';
    }
  } else if (mode === 'register') {
    const st = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => '<option>' + s + '</option>').join('');
    body =
      '<p class="muted" style="margin:0">For retail, distribution and industrial supply businesses. Applications are reviewed by the Weldclass team.</p>' + formNotice('register') +
      '<form class="form" method="post" action="/api/forms/">' + formHidden('register', pageUrl('register')) +
      field('r-fn', 'First name', 'text', true, false, 'first_name') + field('r-ln', 'Last name', 'text', true, false, 'last_name') + field('r-em', 'Email address', 'email', true, false, 'email') + field('r-ph', 'Telephone number', 'tel', true, false, 'phone') + field('r-co', 'Company name', 'text', true, false, 'business') + field('r-abn', 'ABN', 'text', true, false, 'abn') + field('r-st', 'Street address', 'text', true, true, 'street') + field('r-sb', 'Suburb', 'text', true, false, 'suburb') + field('r-pc', 'Postcode', 'text', true, false, 'postcode') +
      '<div class="field"><label for="r-state">State *</label><select id="r-state" name="state" required>' + st + '</select></div>' +
      '<button class="btn btn-o field full" type="submit">Submit application</button></form><a class="arrow" href="' + pageUrl('login') + '" style="font-weight:600">Already have a login?</a>';
  }
  return (
    crumbbar([home, [DEALER_TITLES[mode], '']]) +
    '<section class="sec tight mist"><div class="wrap"><div style="max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 18px 50px rgba(21,22,64,.12)">' +
    '<div style="flex:1 1 400px;min-width:0;position:relative;min-height:520px;background:var(--navy);color:#fff"><img src="' + asset('l-login-weld.jpg') + '" alt="Welder in a Weldclass PROMAX 720R helmet" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(21,22,64,.96) 8%,rgba(21,22,64,.3) 60%,rgba(21,22,64,.05))"></div>' +
    '<div style="position:absolute;inset:auto 0 0;padding:36px"><div class="kick or">Distributors &amp; partners</div><div class="disp" style="color:#fff;font-size:44px;margin-top:8px">Supplying the trade<br>since 1979<span class="dot">.</span></div><div style="display:flex;gap:12px;margin-top:20px"><img src="' + asset('badge-aus-orange.png') + '" alt="" style="height:52px"><img src="' + asset('badge-7yw-orange.png') + '" alt="" style="height:56px"></div></div></div>' +
    '<div style="flex:1 1 440px;min-width:0;padding:44px;display:flex;flex-direction:column;gap:20px"><h1 class="disp" style="font-size:48px">' + esc(DEALER_TITLES[mode]) + '<span class="dot">.</span></h1>' + body + '</div></div></div></section>'
  );
}

/* ---------- Comparisons ---------- */

export function compareBySlug(slug: string): PostRecord | null {
  return compares.find((c) => c.slug === slug) ?? null;
}

export function compareSeo(c: PostRecord): Seo {
  const f = arr<Faq>(c.meta.faq);
  const graph: Record<string, unknown>[] = [];
  if (f.length) graph.push(faqLd(f));
  graph.push(crumbLd([['Home', '/'], ['Compare', pageUrl('compare')], [c.title.split(':')[0], c.path]]));
  return seo({ t: str(c.meta.meta_title) || c.title + ' | Weldclass', d: str(c.meta.meta_desc) || clip(str(c.meta.verdict), 155), url: c.path, graph });
}

export function compareHtml(c: PostRecord): string {
  const ids = compareIds(c).filter((i) => !!p(i));
  const rows = arr<string[]>(c.meta.rows);
  const faq = arr<Faq>(c.meta.faq);
  let o = crumbbar([home, ['Compare', pageUrl('compare')], [c.title.split(':')[0], '']]);
  o += '<section class="sec tight"><div class="wrap" style="max-width:1100px"><div class="kick">Side-by-side comparison</div><h1 class="disp" style="font-size:clamp(34px,4vw,54px);margin:10px 0 16px">' + esc(c.title) + '<span class="dot">.</span></h1>' +
    '<p class="answer" style="font-size:19px;max-width:860px">' + esc(str(c.meta.verdict)) + '</p><div class="cmp-heads">';
  for (const id of ids) {
    const x = p(id)!;
    o += '<a class="card hov" href="' + escUrl(x.url) + '">' + img(x.img, x.name, '', 'medium') + '<b>' + esc(x.name) + '</b><span class="price">' + (x.from ? 'RRP ' + money(x.from) : '') + '</span>' + (x.rating ? '<span class="muted">' + num1(x.rating) + '/10 from ' + x.review_cnt + ' reviews</span>' : '') + '</a>';
  }
  o += '</div>';
  if (ids.length >= 2) {
    o += '<div class="tbl"><table><thead><tr><th>Specification</th><th>' + esc(p(ids[0])!.name) + '</th><th>' + esc(p(ids[1])!.name) + '</th></tr></thead><tbody>';
    for (const r of rows) o += '<tr><th scope="row" style="background:var(--mist2);color:var(--navy)">' + esc(r[0] ?? '') + '</th><td>' + esc(r[1] ?? '') + '</td><td>' + esc(r[2] ?? '') + '</td></tr>';
    o += '</tbody></table></div>';
  }
  o += '<div class="rich art" style="max-width:860px">' + wrapTables(c.content) + '</div>';
  o += faqHtml(faq, 'Questions', 'faq', 'max-width:860px');
  o += '<div class="pcta"><div><div class="disp" style="color:#fff;font-size:28px">Ready to buy<span class="dot">?</span></div><p>Both models are sold through Weldclass distributors across Australia.</p></div><a class="btn btn-o" href="' + pageUrl('where-to-buy') + '">' + icon('pin') + ' Where to buy</a></div></div></section>';
  return o;
}

export function compareIndexHtml(): string {
  let o = band('band-machines.jpg', crumbs([home, ['Compare', '']]), 'Side-by-side', 'Compare Weldclass models', 'Spec-by-spec comparisons of our most asked-about machines and helmets.');
  o += '<section class="sec tight"><div class="wrap grid g2">';
  for (const c of [...compares].sort((a, b) => a.order - b.order || a.id - b.id)) {
    o += '<a class="card hov" href="' + escUrl(c.path) + '" style="padding:24px;color:var(--ink);display:flex;flex-direction:column;gap:8px"><div class="disp" style="font-size:26px">' + esc(c.title) + '</div><p class="muted" style="margin:0">' + esc(str(c.meta.verdict)) + '</p><span class="arrow" style="font-weight:600;color:var(--blue)">Compare</span></a>';
  }
  return o + '</div></section>';
}

/* ---------- 404 ---------- */

export function notFoundHtml(): string {
  return '<section class="sec"><div class="wrap" style="max-width:760px;text-align:center"><div class="kick">Error 404</div><h1 class="disp" style="font-size:56px;margin:10px 0 14px">Sorry, we can\'t find that page<span class="dot">.</span></h1><p class="muted">Try searching for a product or part number, or head back to the homepage.</p><form action="' + pageUrl('search') + '" method="get" style="display:flex;max-width:520px;margin:20px auto"><label class="sr" for="q404">Search</label><input id="q404" name="q" style="flex:1;height:48px;border:1px solid var(--line2);border-radius:4px 0 0 4px;padding:0 14px;font:inherit"><button class="btn btn-b" style="border-radius:0 4px 4px 0">Search</button></form><p style="font-family:var(--f-display);text-transform:uppercase;font-size:22px;color:var(--blue)">Have an #outstanding day<span class="dot">!</span></p></div></section>';
}
