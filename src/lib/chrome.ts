/** Site header (utility strip, search, category bar with mega menus, mobile drawer) and footer. */
import { posts } from './content';
import { allTerms, subs, termUrl, topLabel, tops } from './catalogue';
import { mega } from './blocks';
import { icon, SOCIAL } from './icons';
import { asset, esc, escUrl, mod, pageUrl } from './util';

export function header(curTop = 0): string {
  const ts = tops();
  let h =
    '<a class="sr" href="#main">Skip to content</a>' +
    '<div class="util"><div class="wrap"><div class="aus"><i></i>' + mod('util_text') + '</div><nav aria-label="Utility">' +
    '<a href="' + pageUrl('handy-tools') + '">Handy Tools</a><a href="' + pageUrl('blog') + '">FAQs &amp; Blogs</a><a href="' + pageUrl('catalogue') + '">Catalogue</a><a href="' + pageUrl('warranty') + '">Warranty</a><a href="' + pageUrl('contact') + '">Contact</a><a href="' + pageUrl('register') + '">Apply for a dealer login</a>' +
    '</nav></div></div>' +
    '<header class="hdr"><div class="wrap hdr-top">' +
    '<button class="burger" type="button" aria-label="Open menu" data-act="drawer" aria-controls="drawer" aria-expanded="false">' + icon('menu') + '</button>' +
    '<a class="logo" href="/" aria-label="Weldclass home"><img src="' + asset('logo-blue.png') + '" alt="Weldclass"></a>' +
    '<form class="search" role="search" action="' + pageUrl('search') + '" method="get"><label class="sr" for="q">Search products</label>' +
    '<input id="q" name="q" type="search" autocomplete="off" aria-controls="suggest" aria-expanded="false" aria-autocomplete="list" placeholder="Search by product, part number or category" value="">' +
    '<button type="submit" aria-label="Search">' + icon('search') + '</button><div class="suggest" id="suggest" hidden></div></form>' +
    '<div class="hlinks"><a href="' + pageUrl('login') + '">' + icon('user') + '<span class="lbl">Dealer login</span></a><a href="' + pageUrl('where-to-buy') + '">' + icon('pin') + '<span class="lbl">Where to buy</span></a></div>' +
    '</div><nav class="catbar" aria-label="Product categories"><div class="wrap" id="catbar">';
  for (const t of ts) {
    h += '<div class="cb-item' + (Number(t.id) === Number(curTop) ? ' cur' : '') + '" data-top="' + esc(t.slug) + '"><button type="button" aria-expanded="false" aria-haspopup="true" aria-controls="mega-' + esc(t.slug) + '">' + esc(topLabel(t)) + ' ' + icon('down') + '</button></div>';
  }
  for (const t of ts) h += mega(t);
  h += '</div></nav></header>';
  h += '<div class="drawer" id="drawer" role="dialog" aria-label="Menu" hidden><div class="panel"><a href="/"><img src="' + asset('logo-blue.png') + '" alt="Weldclass" style="height:36px;margin-bottom:12px"></a>';
  for (const t of ts) {
    h += '<details><summary>' + esc(topLabel(t)) + ' ' + icon('down') + '</summary><a href="' + escUrl(termUrl(t)) + '"><b>Shop all ' + esc(topLabel(t)) + '</b></a>';
    for (const s of subs(t)) h += '<a href="' + escUrl(termUrl(s)) + '">' + esc(s.name) + '</a>';
    h += '</details>';
  }
  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:16px"><a class="btn btn-b" href="' + pageUrl('login') + '">Dealer login</a><a class="btn btn-l" href="' + pageUrl('where-to-buy') + '">Where to buy</a></div></div><div class="scrim" data-act="closedrawer"></div></div>';
  return h;
}

function catLink(slug: string): string {
  const t = allTerms().find((x) => x.slug === slug);
  return t ? termUrl(t) : '/category/' + slug + '/';
}
function postLink(slug: string): string {
  const p = posts.find((x) => x.slug === slug);
  return p ? p.path : pageUrl('blog');
}

export function footer(): string {
  let soc = '';
  for (const [k, label] of [['fb', 'Facebook'], ['ig', 'Instagram'], ['yt', 'YouTube'], ['in', 'LinkedIn'], ['tt', 'TikTok']]) {
    const u = mod('social_' + k);
    if (u) soc += '<a href="' + escUrl(u) + '" target="_blank" rel="noopener" aria-label="' + esc(label) + '">' + SOCIAL[k] + '</a>';
  }
  const ht = pageUrl('handy-tools');
  return (
    '<footer class="foot"><div class="wrap"><div class="foot-top">' +
    '<div style="flex:1 1 250px;min-width:0"><img src="' + asset('logo-white.png') + '" alt="Weldclass" style="height:42px;width:auto;margin-bottom:16px">' +
    '<div class="disp" style="color:#fff;font-size:34px;margin-bottom:12px">' + mod('foot_tag') + '<span class="dot">.</span></div>' +
    '<p style="margin:0 0 16px;max-width:300px">' + mod('foot_intro') + '</p>' +
    '<div style="display:flex;gap:12px;align-items:center"><img src="' + asset('badge-aus-orange.png') + '" alt="Australian since 1979" style="height:54px;width:auto"><img src="' + asset('badge-7yw-orange.png') + '" alt="7 year warranty" style="height:58px;width:auto"></div>' +
    '<div class="social" style="margin-top:18px">' + soc + '</div></div>' +
    '<div class="foot-cols">' +
    '<div><h5>Products &amp; Promos</h5><a href="' + catLink('machines') + '">Machines</a><a href="' + catLink('fume-control') + '">Fume Control</a><a href="' + esc(pageUrl('search', { q: 'new' })) + '">Latest Products</a><a href="' + pageUrl('catalogue') + '">Catalogue</a><a href="' + pageUrl('blog') + '">Draws &amp; Competitions</a><a href="' + postLink('weldclass-7-year-warranty') + '">7 Year Warranty Offer</a></div>' +
    '<div><h5>Handy Tools</h5><a href="' + ht + '">Machine Selector Tool</a><a href="' + ht + '">Find a Clear Cover Lens</a><a href="' + ht + '">MIG Torch ID Guide</a><a href="' + ht + '">TIG Torch Selection Guide</a><a href="' + ht + '">Stick Electrode Chart</a><a href="' + ht + '">All guides &amp; charts</a></div>' +
    '<div><h5>Support</h5><a href="' + pageUrl('where-to-buy') + '">Where To Buy</a><a href="' + pageUrl('blog') + '">FAQs &amp; Blogs</a><a href="' + pageUrl('warranty') + '">Warranty Registration</a><a href="' + pageUrl('warranty') + '">Warranty Information</a><a href="' + pageUrl('batch') + '">Batch Certificates</a><a href="' + pageUrl('login') + '">View &amp; Download Invoices</a><a href="' + pageUrl('contact') + '">Contact Weldclass</a></div>' +
    '<div><h5>Weldclass</h5><a href="' + pageUrl('about') + '">About Weldclass</a><a href="' + postLink('line-fill-rate-supply-o-meter') + '">Supply-O-Meter</a><a href="' + pageUrl('register') + '">Apply to become a distributor</a><a href="' + pageUrl('careers') + '">Careers</a><a href="https://surefirecnc.com/" target="_blank" rel="noopener">Surefire CNC</a></div>' +
    '</div></div><div class="foot-bot"><span>' + mod('foot_copy') + '</span><span>' + esc(mod('address')) + ' &middot; ' + esc(mod('phone')) + '</span></div>' +
    '<p style="margin:14px 0 0;font-size:12px;color:#8285B4;max-width:980px">' + mod('foot_note') + '</p></div></footer>' +
    '<div class="toast" id="toast" role="status" hidden></div>'
  );
}
