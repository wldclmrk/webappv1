/** Homepage. Copy comes from content/site.json ("mods"); featured products from the catalogue. */
import { allProductIds, allTerms, featuredIds, p, productMeta, termUrl, topItems, topLabel, tops } from '../catalogue';
import { latestPosts, pcard, postCard } from '../blocks';
import { icon } from '../icons';
import { asset, esc, escUrl, imgUrl, mod, modUrl, num1, pageUrl } from '../util';
import { products } from '../content';

function cat(slug: string): string {
  const t = allTerms().find((x) => x.slug === slug);
  return t ? termUrl(t) : '/';
}

/**
 * One 10/10 review (with a state, 70-230 characters) from each of up to four products: those with a
 * home review position, falling back to the four most-reviewed products.
 */
function homeReviews(): string {
  let ids = products
    .filter((r) => productMeta(Number(r.id)).homeReview !== null)
    .sort((a, b) => (productMeta(Number(a.id)).homeReview ?? 0) - (productMeta(Number(b.id)).homeReview ?? 0))
    .slice(0, 4)
    .map((r) => Number(r.id));
  if (!ids.length) {
    ids = [...products].sort((a, b) => (Number(b.meta.review_count) || 0) - (Number(a.meta.review_count) || 0)).slice(0, 4).map((r) => Number(r.id));
  }
  const picks: [number, { n: string; s?: string; r: number; c: string }][] = [];
  for (const id of ids) {
    for (const r of productMeta(id).reviews) {
      const len = Array.from(r.c ?? '').length;
      if (Number(r.r) === 10 && len > 70 && len < 230 && r.s) {
        picks.push([id, r]);
        break;
      }
    }
  }
  if (!picks.length) return '';
  let h = '<section class="hrevs"><div class="wrap"><div class="sec-head"><div><div class="kick or">#From the welder\'s mouth</div><h2 style="color:#fff">What Australian welders say<span class="dot">.</span></h2></div><span style="color:var(--lav)">Verified reviews collected by ProductReview.com.au</span></div><div class="hrev-grid">';
  for (const [id, r] of picks) {
    const x = p(id)!;
    h += '<figure class="hrev"><div class="hrev-s">' + Number(r.r) + '/10</div><blockquote>' + esc(r.c) + '</blockquote><figcaption><b>' + esc(r.n + ', ' + r.s) + '</b><a href="' + escUrl(x.url) + '">' + esc(x.name) + '</a><span>' + num1(x.rating) + '/10 from ' + x.review_cnt + ' reviews</span></figcaption></figure>';
  }
  return h + '</div></div></section>';
}

export function homeHtml(): string {
  const ts = tops();
  const total = allProductIds().length;
  let h = '<section class="hero" aria-roledescription="carousel">';
  for (let i = 1; i <= 3; i++) {
    const tag = i === 1 ? 'h1' : 'h2';
    h +=
      '<div class="slide" data-slide="' + (i - 1) + '"' + (i > 1 ? ' hidden' : '') + '><img src="' + escUrl(imgUrl(mod(`hero${i}_img`), 'full')) + '" alt=""' + (i > 1 ? ' loading="lazy"' : ' fetchpriority="high"') + '><div class="wrap"><div class="kick or">' + mod(`hero${i}_kick`) + '</div>' +
      '<' + tag + (tag === 'h2' ? ' class="h1"' : '') + '>' + mod(`hero${i}_h`) + '<span class="dot">.</span></' + tag + '><p>' + mod(`hero${i}_p`) + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px"><a class="btn btn-o" href="' + escUrl(modUrl(`hero${i}_a_url`)) + '">' + esc(mod(`hero${i}_a_label`)) + '</a><a class="btn btn-g" href="' + escUrl(modUrl(`hero${i}_b_url`)) + '">' + esc(mod(`hero${i}_b_label`)) + '</a></div></div></div>';
  }
  h += '<div class="dots"><div class="wrap">';
  for (let i = 0; i < 3; i++) h += '<button type="button" data-goslide="' + i + '" aria-label="Slide ' + (i + 1) + '" aria-pressed="' + (i ? 'false' : 'true') + '"><i></i></button>';
  h += '</div></div></section>';

  h +=
    '<section class="trust"><div class="wrap">' +
    '<a class="ti" href="' + pageUrl('about') + '"><img src="' + asset('badge-aus-blue.png') + '" alt="" style="width:58px"><span><b>Australian since 1979</b><span>Owned &amp; run in Tamworth, NSW</span></span></a>' +
    '<a class="ti" href="' + pageUrl('where-to-buy') + '"><span class="ic">' + icon('pin') + '</span><span><b>1,000+ distributors</b><span>Australia &amp; the South Pacific</span></span></a>' +
    '<a class="ti" href="' + pageUrl('warranty') + '"><img src="' + asset('badge-7yw-blue.png') + '" alt="" style="width:46px"><span><b>7-Year Warranty offer*</b><span>Register within 30 days of purchase</span></span></a>' +
    '<a class="ti" href="' + pageUrl('batch') + '"><span class="ic">' + icon('doc') + '</span><span><b>Batch certificates</b><span>Self-serve portal, any time</span></span></a></div></section>';

  const all = esc(pageUrl('search', { q: '' }));
  h += '<section class="sec cats"><div class="wrap"><div class="sec-head"><div><div class="kick">Shop now</div><h2>Shop by category<span class="dot">.</span></h2></div><a class="arrow" href="' + all + '" style="font-weight:600">View all products</a></div><div class="catgrid">';
  ts.forEach((t, i) => {
    const label = topLabel(t);
    h += '<a class="ctile" href="' + escUrl(termUrl(t)) + '"><img src="' + escUrl(imgUrl(t.tile)) + '" alt="' + esc(label) + '"' + (i > 2 ? ' loading="lazy"' : '') + '><div class="ct-in"><span class="ct-n">' + topItems(t).length + ' products &middot; ' + t.subs.length + ' ranges</span><b>' + esc(label) + '<span class="dot">.</span></b><span class="ct-sub">' + esc(t.sub) + '</span><span class="ct-go">Shop ' + esc(label) + '</span></div></a>';
  });
  h += '</div><div style="display:flex;justify-content:center;margin-top:26px"><a class="btn btn-b" href="' + all + '">View all products</a></div></div></section>';

  h +=
    '<section class="sec mist"><div class="wrap" style="display:flex;flex-wrap:wrap;gap:52px;align-items:center"><div style="flex:1 1 360px;position:relative;min-width:0"><figure class="aumap"><img src="' + asset('au-map.svg') + '" alt="Map of Australia showing 1,124 Weldclass distributors, with the head office in Tamworth NSW" width="800" height="720" loading="lazy"><figcaption><span><i class="d"></i>Weldclass distributor</span><span><i class="h"></i>Head office, Tamworth NSW</span></figcaption></figure></div>' +
    '<div style="flex:1 1 440px;min-width:0"><div class="kick">' + mod('welcome_kick') + '</div><h2 class="disp" style="font-size:clamp(34px,4vw,50px);margin:8px 0 22px">' + mod('welcome_h') + '</h2>' +
    '<p style="font-size:18px;margin:0 0 14px">' + mod('welcome_lead') + '</p><p style="margin:0 0 14px;color:var(--ink2)">' + mod('welcome_p') + '</p>' +
    '<blockquote style="margin:0 0 28px;padding:4px 0 4px 20px;border-left:4px solid var(--orange);font-family:var(--f-display);font-weight:500;font-size:21px;line-height:1.25;color:var(--blue);text-transform:uppercase">' + mod('welcome_quote') + '</blockquote>' +
    '<div style="display:flex;flex-wrap:wrap;gap:12px"><a class="btn btn-o" href="' + pageUrl('about') + '">Discover the Weldclass story</a><a class="btn btn-l" href="' + pageUrl('where-to-buy') + '">Find a distributor</a></div></div></div></section>';

  const fume: [string, string, string, string][] = [
    ['ALLCLEAR PD30', 'Personal fume monitor', 'l-fume-pd30.jpg', 'fume-monitors'],
    ['Mobile extractors', 'ALLCLEAR MT84, MT31 & more', 'l-fume-mt84.jpg', 'mobile-extractors'],
    ['Torch & portable', 'On-torch extraction', 'l-fume-mt31.jpg', 'torch-portable-extractors'],
    ['Downdraft tables', 'Extraction at the bench', 'l-fume-table.jpg', 'downdraft-tables'],
  ];
  h +=
    '<section class="sec dark"><div class="wrap"><div class="sec-head"><div style="max-width:720px"><div class="kick or">' + mod('fume_kick') + '</div><h2>' + mod('fume_h') + '<span class="dot">.</span></h2><p style="margin:10px 0 0;color:var(--lav);font-size:18px">' + mod('fume_p') + '</p></div><a class="btn btn-o" href="' + cat('fume-control') + '">Shop fume control</a></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:20px"><a href="' + escUrl(modUrl('fume_feat_url')) + '" style="flex:999 1 520px;min-width:0;position:relative;border-radius:8px;overflow:hidden;display:block;color:#fff;min-height:420px"><img src="' + asset('l-fume-main.jpg') + '" alt="Welder wearing an ALLCLEAR PD30" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><span style="position:absolute;inset:auto 0 0;padding:60px 24px 22px;background:linear-gradient(0deg,rgba(21,22,64,.95),rgba(21,22,64,0))"><span class="kick or">Guide</span><span class="disp" style="display:block;color:#fff;font-size:30px;margin-top:6px">' + esc(mod('fume_feat_h')) + '</span></span></a>' +
    '<div style="flex:1 1 340px;min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px">' +
    fume.map((f) => '<a class="tile" style="aspect-ratio:1/1" href="' + cat(f[3]) + '"><img src="' + asset(f[2]) + '" alt="" loading="lazy"><div><b style="font-size:19px">' + esc(f[0]) + '</b><span style="font-size:13px">' + esc(f[1]) + '</span></div></a>').join('') +
    '</div></div></div></section>';

  h += '<section class="sec"><div class="wrap"><div class="sec-head"><div><div class="kick">Hand picked</div><h2>Featured products<span class="dot">.</span></h2></div><a class="arrow" href="' + all + '" style="font-weight:600">Browse all ' + total + ' products</a></div><div class="grid g4 feat4">' + featuredIds(4).map((id) => pcard(id)).join('') + '</div></div></section>';
  h += homeReviews();
  h += '<section class="sec mist"><div class="wrap"><div class="sec-head"><div><div class="kick">Weldclass Academy</div><h2>From our blog<span class="dot">.</span></h2></div><a class="arrow" href="' + pageUrl('blog') + '" style="font-weight:600">FAQs &amp; all articles</a></div><div class="grid g4 feat4">' + latestPosts(4).map((x) => postCard(x)).join('') + '</div></div></section>';
  return h;
}
