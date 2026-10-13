/** Product category: top-level landing (ranges grid) or sub-category listing (filters, sort, grid/list). */
import { arr, type Faq } from '../content';
import { p, prodsIn, subs, termUrl, topItems, topLabel, topOf, type Term } from '../catalogue';
import { band, catGuide, crumbs, helpStrip, pcard, selectorBanner, sideTree, type Crumb } from '../blocks';
import { icon } from '../icons';
import { crumbLd, faqLd, seo, type Seo } from '../seo';
import { asset, clip, esc, escUrl, img, imgUrl, pageUrl, trimWordsAt, txt } from '../util';

export function categorySeo(t: Term): Seo {
  const isTop = !t.parent;
  const ids = isTop ? topItems(t) : prodsIn(t);
  const label = isTop ? topLabel(t) : t.name;
  const list = ids.slice(0, 30).map((id, i) => {
    const x = p(id);
    return x ? { '@type': 'ListItem', position: i + 1, url: x.url, name: x.name } : null;
  }).filter(Boolean);
  const items: [string, string][] = [['Home', '/']];
  const top = isTop ? null : topOf(t);
  if (top) items.push([topLabel(top), termUrl(top)]);
  items.push([label, termUrl(t)]);
  const graph: Record<string, unknown>[] = [
    { '@type': 'CollectionPage', name: label, url: termUrl(t), mainEntity: { '@type': 'ItemList', numberOfItems: ids.length, itemListElement: list } },
    crumbLd(items),
  ];
  const f = arr<Faq>(t.meta.faq);
  if (f.length) graph.push(faqLd(f));
  return seo({
    t: (t.meta.meta_title as string) || label + ' | Weldclass Australia',
    d: (t.meta.meta_desc as string) || clip(t.desc ? t.desc : 'Shop ' + label + ' from Weldclass, sold through 1,000+ distributors across Australia.', 155),
    url: termUrl(t),
    graph,
  });
}

export function categoryHtml(t: Term): { html: string; curTop: number } {
  const isTop = !t.parent;
  const top = isTop ? t : topOf(t)!;
  const home: Crumb = ['Home', '/'];
  let o = '';

  if (isTop) {
    const items = topItems(t);
    const ss = subs(t);
    const label = topLabel(t);
    const introMeta = String(t.meta.intro ?? '');
    const intro = introMeta ? esc(introMeta) : trimWordsAt(txt(t.desc), 420, 400);
    const isMachines = t.slug === 'machines';
    o += band(t.band, crumbs([home, [label, '']]), esc(ss.length + ' ranges · ' + items.length + ' products'), esc(label), intro);
    o += '<section class="sec tight"><div class="wrap with-side"><aside class="side">' + sideTree(t.id);
    if (!isMachines) {
      o += '<div class="panel-tex"><div class="t">Need a hand choosing<span class="dot">?</span></div><p>Our team can point you to the right product and a distributor near you.</p><a class="btn btn-o btn-sm" href="' + pageUrl('contact') + '">Ask Weldclass</a></div>';
    }
    o += '</aside><div class="main">';
    o += '<div class="sec-head" style="margin-bottom:20px"><h2 style="font-size:34px">Shop ' + esc(label) + ' by type<span class="dot">.</span></h2><span class="muted">' + ss.length + ' categories</span></div><div class="grid g4">';
    for (const s of ss) {
      const n = prodsIn(s).length;
      o += '<a class="card hov" href="' + escUrl(termUrl(s)) + '" style="display:flex;flex-direction:column;overflow:hidden;color:var(--ink)"><div class="zoom" style="aspect-ratio:4/3;background:#fff;padding:14px">' + (s.img ? img(s.img, '', ' style="width:100%;height:100%;object-fit:contain"', 'medium') : '') + '</div><div style="padding:14px 18px 18px;border-top:1px solid var(--line3);display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div class="disp" style="font-size:21px;line-height:1.05">' + esc(s.name) + '</div><div class="muted" style="font-size:13.5px">' + n + ' product' + (n === 1 ? '' : 's') + '</div></div><span class="arrow" style="color:var(--blue)"></span></div></a>';
    }
    o += '</div>';
    if (isMachines) {
      o += selectorBanner();
    } else {
      const desc = txt(t.desc);
      const chars = Array.from(desc);
      o += '<div style="display:flex;flex-wrap:wrap;border-radius:8px;overflow:hidden;background:var(--navy) url(' + asset('l-tex-navy.jpg') + ') center/cover;color:#fff;margin-top:36px"><div style="flex:1 1 300px;min-height:260px"><img src="' + escUrl(imgUrl(t.tile)) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div><div style="flex:2 1 380px;padding:34px;display:flex;flex-direction:column;justify-content:center;gap:12px"><div class="kick or">' + esc(label) + ' by Weldclass</div><div class="disp" style="color:#fff;font-size:36px">' + esc(t.sub) + '<span class="dot">.</span></div><p style="margin:0;color:var(--lav2);max-width:620px">' + esc(chars.slice(0, 260).join('')) + (chars.length > 260 ? '&hellip;' : '') + '</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-o" href="' + pageUrl('where-to-buy') + '">' + icon('pin') + ' Where to buy</a><a class="btn btn-g" href="' + pageUrl('handy-tools') + '">Selection guides</a></div></div></div>';
    }
    o += '<div class="sec-head" style="margin:48px 0 20px"><h2 style="font-size:34px">Popular in ' + esc(label) + '<span class="dot">.</span></h2></div><div class="grid g4">' + items.slice(0, 4).map((id) => pcard(id)).join('') + '</div>';
    o += catGuide(t) + helpStrip() + '</div></div></section>';
  } else {
    const ids = prodsIn(t);
    const ser = new Map<string, number>();
    for (const id of ids) {
      const x = p(id);
      if (x) ser.set(x.series, (ser.get(x.series) ?? 0) + 1);
    }
    // PHP arsort: by count descending, stable for ties.
    const serList = [...ser.entries()].sort((a, b) => b[1] - a[1]);
    const rank: Record<string, number> = { FURY: 0, FORCE: 1, ULTRA: 2 };
    const pos = new Map(ids.map((id, i) => [id, i]));
    const list = [...ids].sort((a, b) => {
      const pa = p(a)!;
      const pb = p(b)!;
      const ra = (/welder|plasma cutter/i.test(pa.name) ? 0 : 10) + (rank[pa.series] ?? 3);
      const rb = (/welder|plasma cutter/i.test(pb.name) ? 0 : 10) + (rank[pb.series] ?? 3);
      return ra - rb || pos.get(a)! - pos.get(b)!;
    });
    const h1 = t.h1 ? t.h1 : t.name;
    const introMeta = String(t.meta.intro ?? '');
    const intro = introMeta ? esc(introMeta) : trimWordsAt(txt(t.desc), 380, 360);
    const seoh1 = String(t.meta.legacy_h1 ?? '');
    const kick = seoh1 && seoh1 !== t.name ? seoh1.split('|')[0].trim() : topLabel(top);

    o += band(top.band, crumbs([home, [topLabel(top), termUrl(top)], [t.name, '']]), esc(kick), esc(h1), intro);
    o += '<section class="sec tight"><div class="wrap with-side"><aside class="side">' + sideTree(top.id, t.id);
    if (top.slug === 'machines') {
      o += '<div class="panel-tex"><div class="t">Need help choosing<span class="dot">?</span></div><p>Answer a few questions and the Machine Selector Tool will suggest a welder.</p><a class="btn btn-o btn-sm" href="' + pageUrl('handy-tools') + '">Start the selector</a></div>';
    } else {
      o += '<div class="panel-tex"><div class="t">Find a distributor<span class="dot">.</span></div><p>Weldclass is sold through 1,000+ trade and industrial stores.</p><a class="btn btn-o btn-sm" href="' + pageUrl('where-to-buy') + '">Where to buy</a></div>';
    }
    o += '</aside><div class="main" data-sublist>';
    o += '<div class="toolbar"><div class="chips" role="group" aria-label="Filter by range">';
    if (serList.length > 1) {
      o += '<button type="button" class="chip" data-sf="all" aria-pressed="true">All<small>(' + ids.length + ')</small></button>';
      for (const [k, n] of serList) o += '<button type="button" class="chip" data-sf="' + esc(k) + '" aria-pressed="false">' + esc(k) + '<small>(' + n + ')</small></button>';
    } else {
      o += '<span class="muted" style="font-size:14px">' + ids.length + ' products</span>';
    }
    o +=
      '</div><div class="right"><span>Showing <b style="color:var(--navy)" data-shown>' + list.length + '</b> of ' + ids.length + '</span><label class="sr" for="sort">Sort</label><select id="sort" data-sort><option value="default" selected>Featured</option><option value="az">Name A–Z</option><option value="price">Price low–high</option></select>' +
      '<div class="seg" role="group" aria-label="View"><button type="button" data-view="grid" aria-label="Grid view" aria-pressed="true">' + icon('grid') + '</button><button type="button" data-view="list" aria-label="List view" aria-pressed="false">' + icon('rows') + '</button></div></div></div>';
    o += '<div class="grid g3" id="plist">' + list.map((id, i) => pcard(id, ' data-idx="' + i + '"')).join('') + '</div>';
    o += catGuide(t) + helpStrip() + '</div></div></section>';
  }
  return { html: o, curTop: Number(top.id) };
}
