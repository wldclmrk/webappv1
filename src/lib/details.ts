/**
 * Product "Details & features" panel: splits the features HTML into headed cards, pulls out
 * "At a glance" and "Functions/Processes" for the navy highlights card, and balances the
 * remaining cards across up to three columns.
 */
import { parseFragment, serializeOuter, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { p } from './catalogue';
import { DT_ICONS } from './icons';
import { esc, txt } from './util';

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

/** Overview content never shows images, embeds or captions: those belong in the gallery and the Videos tab. */
export function stripMedia(html: string): string {
  return String(html)
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<div[^>]*class="[^"]*caption[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<a\b[^>]*>\s*<\/a>/gi, '')
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
}

/**
 * "Details & features" tab: one template for every product. A single full-width Overview card holds
 * the description, then each features section (heading and its list or text) in the order written,
 * then any footnotes. No side panel and no images.
 */
export function detailsPanel(id: number, desc: string, more: string): string {
  const x = p(id)!;
  const f = parseFeatures(more);
  let body = stripMedia(desc + f.intro);
  for (const sec of f.secs) {
    const h = sec.h.replace(/&amp;/g, '&').replace(/\s*:\s*$/, '');
    body += '<h3 class="ov-h">' + esc(h.toUpperCase()) + (/[?!]$/.test(h) ? '' : ':') + '</h3>' + stripMedia(sec.body.join(''));
  }
  if (f.notes) body += '<div class="dt-note">' + stripMedia(f.notes) + '</div>';
  return (
    '<h2 class="sr">' + esc(x.name) + ' details and features</h2>' +
    '<article class="dt-ov ov-one"><div class="dt-h">' + dtIcon('OVERVIEW') + '<h3>Overview</h3></div><div class="rich">' + body + '</div></article>'
  );
}
