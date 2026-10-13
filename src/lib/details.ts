/**
 * Product "Details & features" panel: splits the features HTML into headed cards, pulls out
 * "At a glance" and "Functions/Processes" for the navy highlights card, and balances the
 * remaining cards across up to three columns.
 */
import { parseFragment, serializeOuter, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { productMeta, p } from './catalogue';
import { DT_ICONS, icon } from './icons';
import { esc, img, money, num1, pageUrl, txt } from './util';

export function dtIcon(h: string): string {
  let k = 'check';
  if (/INCLUDE|CONTENT|IN THE BOX|KIT/.test(h)) k = 'box';
  else if (/ACCESSOR|SPARE/.test(h)) k = 'tool';
  else if (/RELATED|ARTICLE|INFORMATION &|GUIDE/.test(h)) k = 'doc';
  else if (/APPLICATION|USE|CAPAB/.test(h)) k = 'target';
  else if (/FAQ|WHAT ELSE|WHY/.test(h)) k = 'q';
  else if (/COMPLIANCE|CLASSIF|STANDARD|QC|SAFETY/.test(h)) k = 'shield';
  else if (/FEATURE|GLANCE|SPECIF|PROCESS|FUNCTION/.test(h)) k = 'star';
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + DT_ICONS[k] + '</svg>';
}

export function titleCase(h: string): string {
  let s = h.replace(/&amp;/g, '&');
  s = s.replace(/\s*:\s*$/, '');
  s = s.replace(/\s*\?\s*$/, '?').trim();
  let t = s.toLowerCase();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.replace(/\b(weldclass|promax|platinum|allclear|force|fury|ultra|gazpro|faqs?|mig|tig|mma|ocv|aws|as\/nzs|qc|ppe|papr|lpg|bzl|twc|bnd)\b/gi, (w) => {
    if (/^weldclass$/i.test(w)) return 'Weldclass';
    if (/^faqs?$/i.test(w)) return 'FAQ' + (w.length > 3 ? 's' : '');
    return w.toUpperCase();
  });
}

type Sec = { h: string; body: string[] };
type Features = { secs: Sec[]; intro: string; notes: string };

type PNode = DefaultTreeAdapterMap['childNode'];
type PElement = DefaultTreeAdapterMap['element'];

function textOf(n: PNode): string {
  if (n.nodeName === '#text') return (n as DefaultTreeAdapterMap['textNode']).value;
  if ('childNodes' in n) return (n.childNodes as PNode[]).map(textOf).join('');
  return '';
}
function firstTag(n: PNode, tag: string): PElement | null {
  if (!('childNodes' in n)) return null;
  for (const c of n.childNodes as PNode[]) {
    if (c.nodeName === tag) return c as PElement;
    const f = firstTag(c, tag);
    if (f) return f;
  }
  return null;
}

/** Parse the features HTML into headed sections, intro and footnotes (HTML5 parsing, as a browser would). */
export function parseFeatures(html: string): Features {
  const out: Features = { secs: [], intro: '', notes: '' };
  if (!String(html).trim()) return out;
  const root = parseFragment(String(html));
  const secs: Sec[] = [];
  const intro: string[] = [];
  const notes: string[] = [];
  let cur = -1;
  for (const n of root.childNodes as PNode[]) {
    if (n.nodeName === '#text') {
      const tx = textOf(n).trim();
      if (tx !== '') (cur >= 0 ? notes : intro).push('<p>' + esc(tx) + '</p>');
      continue;
    }
    if (n.nodeName.startsWith('#')) continue;
    const el = n as PElement;
    const tag = el.tagName.toUpperCase();
    const text = textOf(el).replace(/\s+/g, ' ').trim();
    if (text === '' && tag !== 'UL' && tag !== 'TABLE') continue;
    const strong = tag === 'P' ? firstTag(el, 'strong') : null;
    const len = Array.from(text).length;
    const strongOnly = !!strong && Array.from(textOf(strong).trim()).length >= len - 2 && len < 70;
    const isHead = /^H[2-5]$/.test(tag) || (strongOnly && (text.toUpperCase() === text || /:$/.test(text)));
    if (isHead) {
      secs.push({ h: text.replace(/&/g, '&amp;'), body: [] });
      cur = secs.length - 1;
      continue;
    }
    if (cur >= 0 && ['UL', 'OL', 'TABLE'].includes(tag)) {
      secs[cur].body.push(tag === 'TABLE' ? '<div class="tbl">' + serializeOuter(el) + '</div>' : serializeOuter(el));
      continue;
    }
    if (cur >= 0) {
      if (/^\*/.test(text)) notes.push('<p>' + serialize(el) + '</p>');
      else secs[cur].body.push('<p>' + serialize(el) + '</p>');
      continue;
    }
    intro.push(serializeOuter(el));
  }
  out.secs = secs.filter((s) => s.body.length);
  out.intro = intro.join('');
  out.notes = notes.join('');
  return out;
}

/** List item texts inside a section body. */
export function secLis(sec: Sec | null): string[] {
  if (!sec) return [];
  const m = [...sec.body.join('').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  return m.map((x) => txt(x[1])).filter(Boolean);
}

export function detailsPanel(id: number, desc: string, more: string, gal: number[]): string {
  const x = p(id)!;
  const f = parseFeatures(more);
  const specs = productMeta(id).specs;
  const pick = (re: RegExp): Sec | null => {
    const i = f.secs.findIndex((s) => re.test(s.h.toUpperCase()));
    if (i < 0) return null;
    return f.secs.splice(i, 1)[0];
  };
  const glance = pick(/AT A GLANCE/);
  const funcs = pick(/^(FUNCTIONS|PROCESSES)/);
  let hl = glance ? secLis(glance) : [];
  if (!hl.length && specs.length) hl = specs.slice(0, 4).map((r) => r[0] + ': ' + r[1]);
  if (!hl.length && f.secs.length) {
    const hlSec = f.secs.find((s) => /FEATURE/.test(s.h.toUpperCase())) ?? f.secs[0];
    const all = secLis(hlSec);
    hl = all.slice(0, 4);
    if (hl.length && all.length <= 5) f.secs = f.secs.filter((s) => s !== hlSec);
  }
  const fn = secLis(funcs);
  const descTxt = txt(desc);
  const dlen = Array.from(descTxt).length;
  const img2 = gal[1] ?? 0;
  let inner: Sec | null = null;
  if (dlen < 600 && !img2 && f.secs.length) {
    let ki = 0;
    f.secs.forEach((s, i) => {
      if (/FEATURE/.test(s.h.toUpperCase()) && !ki) ki = i + 1;
    });
    inner = f.secs.splice(ki ? ki - 1 : 0, 1)[0];
  }
  const overview =
    '<article class="dt-ov"><div class="dt-h">' + dtIcon('OVERVIEW') + '<h3>Overview</h3></div><div class="rich">' + desc + f.intro + '</div>' +
    (dlen < 520 && img2 ? '<div class="dt-img">' + img(img2, x.name + ' detail') + '</div>' : '') +
    (inner ? '<div class="dt-inner"><div class="dt-h">' + dtIcon(inner.h.toUpperCase()) + '<h3>' + esc(titleCase(inner.h)) + '</h3></div><div class="rich">' + inner.body.join('') + '</div></div>' : '') +
    '</article>';

  const fp = x.from;
  let side = '<aside class="dt-hl"><div class="kick or">' + (glance ? 'At a glance' : 'Key facts') + '</div>';
  if (hl.length) {
    side += '<ul class="dt-facts">' + hl.slice(0, 5).map((v) => '<li>' + esc(v.replace(/^\*|\*$/g, '').trim()) + '</li>').join('') + '</ul>';
  }
  if (fn.length) {
    side += '<div class="dt-proc"><span>' + esc(titleCase(funcs!.h)) + '</span>' + fn.map((v) => '<b>' + esc(v) + '</b>').join('') + '</div>';
  }
  side +=
    '<div class="dt-buy">' + (x.rating && x.review_cnt >= 3 ? '<div class="dt-rate"><b>' + num1(x.rating) + '</b>/10<span>' + x.review_cnt + ' reviews</span></div>' : '') +
    (fp ? '<div class="dt-rrp"><span>' + (x.prices.length > 1 ? 'RRP from' : 'RRP') + '</span><b>' + money(fp) + '</b></div>' : '') +
    '<a class="btn btn-o" href="' + esc(pageUrl('where-to-buy', { product: id })) + '">' + icon('pin') + ' Where to buy</a></div></aside>';

  const cards = f.secs.map((s) => {
    const H = s.h.toUpperCase();
    const cls = /RELATED|ARTICLE/.test(H) ? ' dt-links' : /INCLUDE|CONTENT/.test(H) ? ' dt-box' : '';
    return '<section class="dt-card' + cls + '"><div class="dt-h">' + dtIcon(H) + '<h3>' + esc(titleCase(s.h)) + '</h3></div><div class="rich">' + s.body.join('') + '</div></section>';
  });
  const ncol = Math.min(3, cards.length);
  let grid = '';
  if (ncol) {
    const cols: string[][] = Array.from({ length: ncol }, () => []);
    const hts = new Array(ncol).fill(0);
    for (const html of cards) {
      const w = 90 + (html.match(/<li/g) ?? []).length * 30 + Array.from(txt(html)).length * 0.35;
      const k = hts.indexOf(Math.min(...hts));
      cols[k].push(html);
      hts[k] += w;
    }
    grid = '<div class="dt-cols n' + ncol + '">' + cols.map((c) => '<div class="dt-col">' + c.join('') + '</div>').join('') + '</div>';
  }
  return '<h2 class="sr">' + esc(x.name) + ' details and features</h2><div class="dt"><div class="dt-top">' + overview + side + '</div>' + grid + (f.notes ? '<div class="dt-note">' + f.notes + '</div>' : '') + '</div>';
}
