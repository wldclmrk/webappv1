/** Product page: gallery, answer-first summary, RRP block, part number table, tabbed details. */
import { comparesForProduct, has7yw, p, parts as getParts, primarySub, prodsIn, productMeta, termUrl, topLabel, topOf, upsells, type P } from '../catalogue';
import { crumbbar, faqHtml, pcard, type Crumb } from '../blocks';
import { detailsPanel } from '../details';
import { icon } from '../icons';
import { crumbLd, faqLd, seo, type Seo } from '../seo';
import { abs, asset, clip, esc, escUrl, img, imgUrl, mod, money, pageUrl, txt, wpautopIfPlain } from '../util';

function data(x: P) {
  const id = x.id;
  const sub = primarySub(id);
  const top = topOf(sub);
  const m = productMeta(id);
  const gal = [...new Set([x.img, ...x.gallery].filter(Boolean))].slice(0, 6);
  let glance: string[] = [];
  const gm = m.more.match(/AT A GLANCE:?\s*<\/strong>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/i) ?? m.more.match(/AT A GLANCE:?[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
  if (gm) glance = [...gm[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((l) => txt(l[1])).slice(0, 4);
  const parts = getParts(id);
  const specRows: [string, string][] = m.specs.length ? m.specs : glance.map((g) => ['', g]);
  return { id, sub, top, m, gal, glance, parts, specRows };
}

export function productSeo(x: P): Seo {
  const { id, sub, top, m, parts } = data(x);
  const fp = x.from;
  const imgs = [x.img, ...x.gallery].map((i) => imgUrl(i, 'large')).filter(Boolean).slice(0, 4).map(abs);
  const o: Record<string, unknown> = {
    '@type': 'Product',
    '@id': abs(x.url) + '#product',
    name: x.name,
    url: abs(x.url),
    description: x.summary ? x.summary : clip(x.blurb, 300),
    brand: { '@type': 'Brand', name: 'Weldclass' },
    manufacturer: { '@id': abs('/') + '#org' },
    image: imgs,
  };
  if (sub) o.category = sub.name;
  if (parts.length) {
    o.sku = parts[0].pn;
    o.mpn = parts[0].pn;
  }
  if (x.aka) o.alternateName = x.aka;
  if (m.specs.length) o.additionalProperty = m.specs.map((r) => ({ '@type': 'PropertyValue', name: r[0], value: r[1] ?? '' }));
  if (x.prices.length) {
    o.offers = {
      '@type': 'AggregateOffer', priceCurrency: 'AUD', lowPrice: Math.min(...x.prices).toFixed(2), highPrice: Math.max(...x.prices).toFixed(2), offerCount: x.prices.length, url: abs(pageUrl('where-to-buy')),
      priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'AUD', valueAddedTaxIncluded: true },
    };
  }
  const items: [string, string][] = [['Home', '/']];
  if (top && sub) items.push([topLabel(top), termUrl(top)], [sub.name, termUrl(sub)]);
  items.push([x.name, x.url]);
  const graph: Record<string, unknown>[] = [o, crumbLd(items)];
  if (m.faq.length) graph.push(faqLd(m.faq));
  const nameT = Array.from(x.name).length > 44 ? x.name : x.name + ' | Weldclass Australia';
  return seo({
    t: m.metaTitle || Array.from(nameT).slice(0, 70).join(''),
    d: m.metaDesc || clip(x.summary ? x.summary : x.blurb, 150) + (fp && Array.from(x.summary).length < 120 ? ' RRP ' + money(fp) + '.' : ''),
    img: imgUrl(x.img, 'large'),
    type: 'product',
    url: x.url,
    graph,
  });
}

export function productHtml(x: P): { html: string; curTop: number } {
  const { id, sub, top, m, gal, glance, parts, specRows } = data(x);
  const faq = m.faq;
  const dls = m.downloads;
  const vids = m.videos;
  const reviews = m.reviews;
  const tabs = ([
    ['details', 'Details & features', 0],
    ['specs', 'Specifications', 0],
    ['faq', 'FAQs', faq.length],
    ['downloads', 'Downloads', dls.length],
    ['videos', 'Videos', vids.length],
    ['reviews', 'Reviews', reviews.length],
  ] as [string, string, number][]); // Same six tabs on every product; empty ones say so.
  let rel = upsells(id).filter((r) => !!p(r)).slice(0, 8);
  if (!rel.length && sub) rel = prodsIn(sub).filter((r) => r !== id).slice(0, 4);
  const descRaw = x.rec.description;
  const desc = descRaw.trim() !== '' ? wpautopIfPlain(descRaw) : '<p>' + esc(x.blurb) + '</p>';
  const has7 = has7yw(id);
  const fp = x.from;
  const many = x.prices.length > 1;
  const wtb = esc(pageUrl('where-to-buy', { product: id }));

  /* Panels */
  const panel: Record<string, string> = {};
  panel.details = detailsPanel(id, desc, m.more);

  let h = '<h2 class="disp" style="font-size:28px;margin-bottom:14px">' + esc(x.name) + ' specifications<span class="dot">.</span></h2><div class="tbl" style="max-width:820px"><table><tbody>';
  for (const r of specRows) {
    h += '<tr>' + ((r[0] ?? '') !== '' ? '<th scope="row" style="background:var(--mist2);color:var(--navy);width:38%">' + esc(r[0]) + '</th><td>' + esc(r[1] ?? '') + '</td>' : '<td colspan="2">' + esc(r[1] ?? '') + '</td>') + '</tr>';
  }
  h += '</tbody></table></div>' + (parts.length ? '<p class="muted" style="font-size:14px">Part numbers and RRPs are listed at the top of this page. Specifications are subject to change without notice.</p>' : '');
  panel.specs = h;

  panel.faq = '<h2 class="disp" style="font-size:28px;margin-bottom:6px">' + esc(x.name) + ' FAQs<span class="dot">.</span></h2>' + faqHtml(faq, '', 'pfaq-list', 'margin-top:0;max-width:860px');

  h = '<h2 class="sr">Downloads</h2><div class="grid g3">';
  for (const d of dls) {
    const label = Array.isArray(d) ? d[0] ?? '' : d;
    const url = Array.isArray(d) && d[1] ? d[1] : '#';
    h += '<a class="card hov" href="' + escUrl(url) + '" target="_blank" rel="noopener" style="display:flex;gap:14px;align-items:center;padding:18px;color:var(--navy);font-weight:600"><span class="ic lt" style="border-radius:6px">' + icon('dl') + '</span>' + esc(label.replace(/^Download\s+/i, '')) + '</a>';
  }
  panel.downloads = h + '</div>';

  h = '<h2 class="sr">Videos</h2><div class="grid g3">';
  vids.forEach((v, i) => {
    const vm = v.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    const vid = vm ? vm[1] : v;
    h += '<a class="vid" href="https://www.youtube.com/watch?v=' + esc(vid) + '" target="_blank" rel="noopener" aria-label="Watch ' + esc(x.name) + ' video ' + (i + 1) + ' on YouTube"><i>' + icon('play') + '</i><span>Watch on YouTube</span></a>';
  });
  panel.videos = h + '</div>';

  if (reviews.length) {
    const n = reviews.length;
    const avg = x.rating ? x.rating : (reviews.reduce((s, r) => s + Number(r.r), 0) / n).toFixed(2);
    h =
      '<h2 class="disp" style="font-size:28px;margin-bottom:8px">' + esc(x.name) + ' reviews<span class="dot">.</span></h2>' +
      '<p class="rsum">' + esc(m.rsum ? m.rsum : x.name + ' is rated ' + avg + ' out of 10 from ' + n + ' verified customer reviews collected by ProductReview.com.au.') + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start"><div style="flex:1 1 260px;max-width:360px;background:var(--navy) url(' + asset('l-tex-navy.jpg') + ') center/cover;color:#fff;border-radius:8px;padding:26px;display:flex;flex-direction:column;gap:14px">' +
      '<div class="disp" style="color:#fff;font-size:70px">' + esc(avg) + '<span style="font-size:26px;color:#B9BCE0">/10</span></div>' +
      '<div style="color:var(--lav)">Average "likely to recommend" score from <b style="color:#fff">' + n + ' reviews</b>.</div><div style="display:flex;flex-direction:column;gap:6px">';
    for (const k of [10, 9, 8, 7]) {
      const c = reviews.filter((r) => (k === 7 ? Number(r.r) <= 7 : Number(r.r) === k)).length;
      const pc = Math.round((c / n) * 100);
      h += '<div style="display:grid;grid-template-columns:44px 1fr 44px;gap:8px;align-items:center;font-size:14px;color:var(--lav)"><span>' + (k === 7 ? '&le;7' : k) + '/10</span><span style="height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden"><i style="display:block;height:100%;width:' + pc + '%;background:var(--orange)"></i></span><span style="text-align:right;font-variant-numeric:tabular-nums">' + c + '</span></div>';
    }
    h +=
      '</div>' + (m.reviewLink ? '<a href="' + escUrl(m.reviewLink) + '" target="_blank" rel="noopener" style="color:#fff;font-weight:600;text-decoration:underline">Read these reviews on ProductReview.com.au</a>' : '') + '</div>' +
      '<div style="flex:3 1 520px;min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="color:var(--navy)">All ' + n + ' reviews, newest first</b><span class="muted" style="font-size:14px">Scroll to read more</span></div><div class="revs" tabindex="0" aria-label="Customer reviews of ' + esc(x.name) + '">';
    for (const r of reviews) {
      h += '<article class="rev"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b style="color:var(--navy)">' + esc(r.n + (r.s ? ', ' + r.s : '')) + '</b><span class="score" aria-label="Rated ' + Number(r.r) + ' out of 10">' + Number(r.r) + '/10</span></div><p style="margin:0;color:var(--ink2);font-size:15px">' + esc(r.c) + '</p>' + (r.d ? '<div style="font-size:13px;color:var(--ink4)">Reviewed ' + esc(r.d) + '</div>' : '') + '</article>';
    }
    panel.reviews = h + '</div></div></div>';
  }

  /* Every product shows the same six tabs; a tab with nothing to show says so plainly. */
  const empty = (msg: string) =>
    '<div class="tab-empty"><p>' + msg + '</p><p>Questions about this product? Call ' + esc(mod('phone')) + ' or <a href="' + pageUrl('contact') + '">contact us</a>.</p></div>';
  if (!specRows.length) panel.specs = empty('Specifications for ' + esc(x.name) + ' are listed in the part number table at the top of this page.');
  if (!faq.length) panel.faq = empty('There are no FAQs for ' + esc(x.name) + ' yet.');
  if (!dls.length) panel.downloads = empty('There are no downloads for ' + esc(x.name) + ' yet.');
  if (!vids.length) panel.videos = empty('There are no videos for ' + esc(x.name) + ' yet.');
  if (!reviews.length) panel.reviews = empty('There are no reviews for ' + esc(x.name) + ' yet.');

  /* Page */
  const cr: Crumb[] = [['Home', '/']];
  if (top && sub) cr.push([topLabel(top), termUrl(top)], [sub.name, termUrl(sub)]);
  cr.push([x.name, '']);
  let o = crumbbar(cr);

  o += '<section class="sec tight"><div class="wrap pp-top"><div class="gal" data-gallery><div class="mainimg">' + img(gal[0] ?? x.img, x.name, ' data-main fetchpriority="high"', 'woocommerce_single') + (has7 ? '<img class="wb" src="' + asset('badge-7yw-orange.png') + '" alt="7 Year Warranty offer">' : '') + '</div>';
  if (gal.length > 1) {
    o += '<div class="thumbs" role="group" aria-label="Product images">';
    gal.forEach((g, i) => {
      o += '<button type="button" data-thumb="' + i + '" data-full="' + escUrl(imgUrl(g, 'woocommerce_single')) + '" aria-label="Show image ' + (i + 1) + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' + img(g, x.name + ' image ' + (i + 1), '', 'thumbnail') + '</button>';
    });
    o += '</div>';
  }
  o += '</div><div class="buy"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="tag">' + esc(x.series) + '</span>' + (x.pulse ? '<span class="tag or">Pulse</span>' : '') + (x.aka ? '<span class="muted" style="font-size:14px">Also known as: ' + esc(x.aka) + '</span>' : '') + '</div>';
  o += '<h1>' + esc(x.name) + '</h1>';
  if (x.rating) {
    o += '<button type="button" class="rating" data-tab="reviews"><b>' + esc(x.rating) + '<span style="font-size:13px;color:#B9BCE0">/10</span></b><span>Average rating' + (reviews.length ? ' &middot; <u style="color:var(--blue);font-weight:600">Read reviews</u>' : '') + '</span></button>';
  }
  if (x.summary) {
    o += '<p class="answer">' + esc(x.summary) + '</p>' + (x.who ? '<p class="who"><b>Who it suits:</b> ' + esc(x.who) + '</p>' : '');
  }
  o +=
    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;padding:18px 20px;border-radius:8px;background:var(--mist);border:1px solid var(--line)">' +
    '<div style="flex:1 1 200px"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink4)">' + (fp ? (many ? 'RRP from' : 'Recommended retail price') : 'Pricing') + '</div>' +
    (fp ? '<div class="price" style="font-size:40px;line-height:1.05">' + money(fp) + '</div><div class="muted" style="font-size:13px">incl. GST' + (many ? ' &middot; ' + x.prices.length + ' options below' : '') + '</div>' : '<div style="font-weight:600;color:var(--navy);font-size:18px">Available from Weldclass distributors</div>') + '</div>' +
    '<div style="flex:1 1 230px;display:flex;flex-direction:column;gap:6px"><a class="btn btn-o" style="min-height:54px;font-size:19px" href="' + wtb + '">' + icon('pin') + ' Where to buy</a><span class="muted" style="font-size:13px;text-align:center">1,000+ distributors across Australia</span></div></div>';
  if (!x.summary) {
    o += '<div><p class="blurb">' + esc(x.blurb) + '</p><button type="button" data-tab="details" class="morelink">Read full description</button></div>';
  }
  if (glance.length) o += '<div class="glance">' + glance.map((g) => '<div>' + esc(g) + '</div>').join('') + '</div>';
  if (parts.length) {
    const manyParts = parts.length > 10;
    const hasTh = parts.some((q) => q.img);
    o += '<div class="ptable" id="parts"><div class="ph"><span>Part numbers &amp; RRP</span><span style="color:var(--lav)">' + parts.length + ' option' + (parts.length > 1 ? 's' : '') + '</span></div>';
    if (manyParts) o += '<div class="pfilter"><label class="sr" for="pf-in">Filter part numbers</label><input id="pf-in" data-pfilter placeholder="Filter ' + parts.length + ' part numbers by number or description"></div>';
    o += '<div class="plist" role="list">';
    for (const q of parts) {
      const d = q.d.replace(/\s*Also (available|known)[\s\S]*$/i, '').trim();
      o += '<div class="prow' + (hasTh ? ' wth' : '') + '" role="listitem" data-ptext="' + esc((q.pn + ' ' + d).toLowerCase()) + '">' + (hasTh ? '<span class="pth">' + (q.img ? img(q.img, q.pn + ' ' + Array.from(d).slice(0, 60).join(''), '', 'thumbnail') : '') + '</span>' : '') + '<span class="pn">' + esc(q.pn) + '</span><span class="pd">' + esc(d) + '</span><span class="pp">' + (q.p ? esc(q.p) : '<span class="na">See distributor</span>') + '</span></div>';
    }
    o += '</div><div class="pnone" hidden>No part numbers match.</div></div>';
  }
  if (has7) {
    o += '<div class="note"><img src="' + asset('badge-7yw-orange.png') + '" alt="" style="width:40px;flex:0 0 auto"><div><b>7-year warranty offer*.</b> Register online within 30 days of purchase to qualify for the extended warranty. <a href="' + pageUrl('warranty') + '">Warranty details</a></div></div>';
  }
  const cmps = comparesForProduct(id);
  if (cmps.length) {
    o += '<div class="cmplinks"><b>Compare:</b> ' + cmps.map((c) => '<a href="' + escUrl(c.path) + '">' + esc(c.title.split(':')[0]) + '</a>').join(' &middot; ') + '</div>';
  }
  o += '</div></div></section>';

  o += '<section class="sec tight mist" id="tabs"><div class="wrap"><div class="tabs" role="tablist" aria-label="Product information">';
  tabs.forEach((t, i) => {
    o += '<button type="button" role="tab" id="tb-' + t[0] + '" aria-controls="tp-' + t[0] + '" data-tab="' + t[0] + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(t[1]) + (t[2] ? '<small>' + t[2] + '</small>' : '') + '</button>';
  });
  o += '</div>';
  tabs.forEach((t, i) => {
    o += '<div role="tabpanel" id="tp-' + t[0] + '" aria-labelledby="tb-' + t[0] + '"' + (i === 0 ? '' : ' hidden') + '>' + (panel[t[0]] ?? '') + '</div>';
  });
  o += '</div></section>';

  o += '<div class="buybar"><div><b>' + esc(x.name) + '</b><span class="price" style="font-size:18px">' + (fp ? (many ? 'From ' : '') + money(fp) : 'See distributors') + '</span></div><a class="btn btn-o btn-sm" href="' + wtb + '">' + icon('pin') + ' Where to buy</a></div>';

  if (rel.length) {
    o += '<section class="sec tight"><div class="wrap"><div class="sec-head"><h2 style="font-size:36px">Related products<span class="dot">.</span></h2></div><div class="grid g4">' + rel.map((r) => pcard(r)).join('') + '</div></div></section>';
  }
  return { html: o, curTop: top ? Number(top.id) : 0 };
}
