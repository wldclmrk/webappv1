/* Weldclass site interactions (ported from the Version A prototype). Plain script, no framework. */
(function () {
'use strict';
var CFG = window.WELDCLASS || {};
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('wc-' + k)); localStorage.setItem('wc-' + k, JSON.stringify(v)); } catch (e) { return null; } }
var PIN = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>';

/* ---------- Mega menu ---------- */
var megaTimer;
function closeMega() {
  $$('.mega').forEach(function (m) { m.hidden = true; });
  $$('.cb-item').forEach(function (c) { c.classList.remove('open'); var b = $('button', c); if (b) b.setAttribute('aria-expanded', 'false'); });
}
function openMega(slug) {
  closeMega();
  var m = document.getElementById('mega-' + slug); if (!m) return;
  m.hidden = false;
  $$('.cb-item').forEach(function (c) { var on = c.getAttribute('data-top') === slug; c.classList.toggle('open', on); $('button', c).setAttribute('aria-expanded', String(on)); });
}
document.addEventListener('mouseover', function (e) {
  if (!e.target.closest) return;
  var it = e.target.closest('.cb-item'), mg = e.target.closest('.mega');
  if (it) { clearTimeout(megaTimer); var s = it.getAttribute('data-top'); if (!it.classList.contains('open')) megaTimer = setTimeout(function () { openMega(s); }, 120); }
  else if (mg) clearTimeout(megaTimer);
  else if ($('.mega:not([hidden])')) { clearTimeout(megaTimer); megaTimer = setTimeout(closeMega, 220); }
});

/* ---------- Hero carousel ---------- */
var heroT;
function showSlide(i) {
  $$('.hero .slide').forEach(function (s) { s.hidden = +s.getAttribute('data-slide') !== i; });
  $$('.hero [data-goslide]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-goslide') === i)); });
}
(function startHero() {
  if (!$('.hero')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var i = 0, n = $$('.hero .slide').length;
  heroT = setInterval(function () { i = (i + 1) % n; showSlide(i); }, 6500);
})();

/* ---------- Toast ---------- */
var toastT;
function toast(html) { var t = $('#toast'); if (!t) return; t.innerHTML = html; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800); }

/* ---------- Search suggestions ---------- */
var IDX = null, idxLoading = false, idxWaiting = [], sugT, sugSel = -1;
function loadIndex(cb) {
  if (IDX) return cb();
  idxWaiting.push(cb);
  var key = 'wc-idx-' + (CFG.ver || 1);
  try { var c = sessionStorage.getItem(key); if (c) { IDX = JSON.parse(c); return flushIdx(); } } catch (e) {}
  if (idxLoading) return; idxLoading = true;
  var box = $('#suggest');
  fetch(CFG.rest + 'index?v=' + encodeURIComponent(CFG.ver || 1), { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { IDX = d; idxLoading = false; try { sessionStorage.setItem(key, JSON.stringify(d)); } catch (e) {} flushIdx(); })
    .catch(function () { idxLoading = false; idxWaiting = []; if (box && !box.hidden) box.innerHTML = '<div class="sh">Search is unavailable right now. Press Enter to search.</div>'; });
}
function flushIdx() { var w = idxWaiting; idxWaiting = []; w.forEach(function (f) { f(); }); }
function hideSuggest() { var s = $('#suggest'); if (s) { s.hidden = true; } sugSel = -1; var q = $('#q'); if (q) q.setAttribute('aria-expanded', 'false'); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function suggest() {
  var box = $('#suggest'), inp = $('#q'); if (!box || !inp) return;
  var raw = inp.value.trim(), q = raw.toLowerCase();
  if (q.length < 2) return hideSuggest();
  if (!IDX) { box.innerHTML = '<div class="sh">Searching&hellip;</div>'; box.hidden = false; }
  loadIndex(function () {
    if (inp.value.trim().toLowerCase() !== q) return; /* a newer keystroke will render */
    var words = norm(q).split(' ').filter(Boolean);
    var hit = function (hay) { hay = norm(hay); return words.every(function (w) { return hay.indexOf(w) > -1; }); };
    var ps = IDX.p.filter(function (p) { return p[1].indexOf(q) > -1 || hit(p[1]); });
    ps.sort(function (a, b) { return (b[0].toLowerCase().indexOf(q) > -1) - (a[0].toLowerCase().indexOf(q) > -1); });
    ps = ps.slice(0, 6);
    var cs = IDX.c.filter(function (c) { return hit(c[0]); }).slice(0, 3);
    var all = CFG.search + (CFG.search.indexOf('?') > -1 ? '&' : '?') + 'q=' + encodeURIComponent(raw);
    sugSel = -1;
    if (!ps.length && !cs.length) { box.innerHTML = '<div class="sh">No quick matches. Press Enter to search all products.</div>'; box.hidden = false; return; }
    box.innerHTML = (cs.length ? '<div class="sh">Categories</div>' + cs.map(function (s) { return '<a href="' + esc(s[1]) + '">' + (s[2] ? '<img src="' + esc(s[2]) + '" alt="">' : '') + '<span>' + esc(s[0]) + '</span></a>'; }).join('') : '') +
      (ps.length ? '<div class="sh">Products</div>' + ps.map(function (p) { return '<a href="' + esc(p[2]) + '">' + (p[3] ? '<img src="' + esc(p[3]) + '" alt="">' : '') + '<span><b style="font-weight:600;color:var(--navy)">' + esc(p[0]) + '</b><br><small class="muted">' + esc(p[4]) + (p[5] ? ' &middot; RRP ' + esc(p[5]) : '') + '</small></span></a>'; }).join('') : '') +
      '<a href="' + esc(all) + '" style="justify-content:center;font-weight:600;color:var(--blue)">See all results</a>';
    box.hidden = false; inp.setAttribute('aria-expanded', 'true');
  });
}
function moveSuggest(d) {
  var links = $$('#suggest a'); if (!links.length) return false;
  sugSel = (sugSel + d + links.length) % links.length;
  links.forEach(function (a, i) { a.classList.toggle('on', i === sugSel); });
  links[sugSel].scrollIntoView({ block: 'nearest' });
  return true;
}

/* ---------- Sub-category listing: range filter, sort, grid/list ---------- */
function subList() {
  var main = $('[data-sublist]'); if (!main) return;
  var grid = $('#plist', main), cards = $$('.pc', grid);
  var st = { f: 'all', sort: 'default', view: store('view') || 'grid' };
  function apply() {
    var list = cards.slice();
    if (st.sort === 'az') list.sort(function (a, b) { return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name')); });
    else if (st.sort === 'price') list.sort(function (a, b) { return (+a.getAttribute('data-price') || 1e9) - (+b.getAttribute('data-price') || 1e9); });
    else list.sort(function (a, b) { return +a.getAttribute('data-idx') - +b.getAttribute('data-idx'); });
    var shown = 0;
    list.forEach(function (c) { var ok = st.f === 'all' || c.getAttribute('data-series') === st.f; c.hidden = !ok; if (ok) shown++; grid.appendChild(c); });
    var n = $('[data-shown]', main); if (n) n.textContent = shown;
    $$('[data-sf]', main).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sf') === st.f)); });
    $$('[data-view]', main).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === st.view)); });
    grid.className = 'grid ' + (st.view === 'list' ? 'list' : 'g3');
  }
  main.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-sf]'))) { st.f = b.getAttribute('data-sf'); apply(); }
    else if ((b = e.target.closest('[data-view]'))) { st.view = b.getAttribute('data-view'); store('view', st.view); apply(); }
  });
  var sel = $('[data-sort]', main); if (sel) sel.addEventListener('change', function () { st.sort = sel.value; apply(); });
  apply();
}

/* ---------- Product page: gallery, tabs, part filter ---------- */
function showTab(name, scroll) {
  var tab = document.getElementById('tb-' + name); if (!tab) return;
  $$('[role=tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
  $$('[role=tabpanel]').forEach(function (p) { p.hidden = p.id !== 'tp-' + name; });
  if (scroll) { var tb = $('#tabs'); if (tb) tb.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

/* ---------- Blog: topic chips + instant search ---------- */
function blogList() {
  var wrap = $('[data-blog]'); if (!wrap) return;
  var cat = 'All', q = '';
  var feat = $('[data-bfeat]', wrap), list = $('#bloglist', wrap), title = $('[data-btitle]', wrap), count = $('#bcount', wrap), none = $('#bnone', wrap);
  function apply() {
    var filtering = cat !== 'All' || q;
    if (feat) feat.hidden = !!filtering;
    var n = 0;
    $$('.bcard', list).forEach(function (c) {
      var dup = c.hasAttribute('data-featdup');
      var ok = (cat === 'All' || c.getAttribute('data-bcat') === cat) && (!q || c.getAttribute('data-text').indexOf(q) > -1) && (!dup || filtering);
      c.hidden = !ok; if (ok) n++;
    });
    if (title) title.innerHTML = esc(filtering ? (cat === 'All' ? 'Articles' : cat) : 'Latest articles') + '<span class="dot">.</span>';
    if (count) count.textContent = n + ' article' + (n === 1 ? '' : 's');
    if (none) none.hidden = n > 0;
    $$('[data-bcatf]', wrap).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-bcatf') === cat)); });
  }
  wrap.addEventListener('click', function (e) { var b = e.target.closest('[data-bcatf]'); if (b) { cat = b.getAttribute('data-bcatf'); apply(); } });
  var inp = $('[data-blogq]', wrap); if (inp) inp.addEventListener('input', function () { q = inp.value.trim().toLowerCase(); apply(); });
}

/* ---------- Handy tools topic chips ---------- */
function toolsFilter() {
  var wrap = $('[data-tools]'); if (!wrap) return;
  wrap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ht]'); if (!b) return;
    var t = b.getAttribute('data-ht');
    $$('[data-ht]', wrap).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    $$('.toolcard', wrap).forEach(function (c) { c.hidden = !(t === 'all' || c.getAttribute('data-topic') === t); });
  });
}

/* ---------- Where to buy ---------- */
function wtb() {
  var wrap = $('[data-wtb]'); if (!wrap) return;
  var out = $('[data-wtb-out]', wrap), DIST = null;
  var st = { q: wrap.getAttribute('data-q') || 'Tamworth NSW 2340', r: +wrap.getAttribute('data-r') || 25, sel: 0 };
  function km(a, b, c, d) { var R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) * Math.sin(y / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
  function geo(q) {
    q = (q || '').trim(); if (!q || !DIST) return null;
    var pc = (q.match(/\b(\d{4})\b/) || [])[1], hits = [];
    if (pc) { hits = DIST.filter(function (d) { return d[4] === pc; }); if (!hits.length) { var n = +pc, best = null; DIST.forEach(function (d) { var v = Math.abs(+d[4] - n); if (d[4] && (!best || v < best[0])) best = [v, d]; }); if (best && best[0] < 60) hits = [best[1]]; } }
    if (!hits.length) { var w = q.toLowerCase().replace(/\b(nsw|vic|qld|wa|sa|tas|act|nt)\b/g, '').replace(/[^a-z ]/g, '').trim(); if (w) hits = DIST.filter(function (d) { return (d[2] || '').toLowerCase() === w; }); }
    if (!hits.length) return null;
    var la = 0, lo = 0; hits.forEach(function (d) { la += d[6]; lo += d[7]; });
    return { la: la / hits.length, lo: lo / hits.length, label: hits[0][2] + ' ' + hits[0][3] + ' ' + hits[0][4] };
  }
  function card(d, i, dist, on) {
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d[0] + ' ' + d[1] + ' ' + d[2] + ' ' + d[3] + ' ' + d[4]);
    return '<article class="store' + (on ? ' on' : '') + '" data-store="' + i + '"><span class="num">' + (i + 1) + '</span><div style="min-width:0;flex:1"><div style="display:flex;justify-content:space-between;gap:10px"><h3 class="sname">' + esc(d[0]) + '</h3><span class="muted" style="font-size:14px;white-space:nowrap">' + dist.toFixed(1) + ' km</span></div>' +
      '<p class="saddr">' + esc(d[1]) + ', ' + esc(d[2]) + ' ' + esc(d[3]) + ' ' + esc(d[4]) + '</p><div class="sact">' + (d[5] ? '<a class="btn btn-b btn-sm" href="tel:' + esc(d[5].replace(/[^\d+]/g, '')) + '">Call ' + esc(d[5]) + '</a>' : '') + '<a class="btn btn-l btn-sm" href="' + maps + '" target="_blank" rel="noopener">Directions</a>' + (d[8] ? '<a class="btn btn-l btn-sm" href="' + esc(d[8]) + '" target="_blank" rel="noopener">Website</a>' : '') + '</div></div></article>';
  }
  function render() {
    $$('[data-rad]', wrap).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-rad') === st.r)); });
    if (!DIST) { out.innerHTML = '<div class="empty">Loading distributors&hellip;</div>'; return; }
    var g = geo(st.q);
    if (!g) { out.innerHTML = '<div class="empty"><div class="disp" style="font-size:26px">We couldn\'t find &ldquo;' + esc(st.q) + '&rdquo;</div><p>Try a 4-digit postcode, or browse <a href="' + esc(wrap.querySelector('a.arrow').href) + '">stockists by state</a>.</p></div>'; return; }
    var vis = DIST.map(function (d) { return [d, km(g.la, g.lo, d[6], d[7])]; }).filter(function (x) { return x[1] <= st.r; }).sort(function (a, b) { return a[1] - b[1]; }).slice(0, 60);
    if (st.sel >= vis.length) st.sel = 0;
    var map = '';
    if (vis.length) {
      var las = vis.map(function (x) { return x[0][6]; }), los = vis.map(function (x) { return x[0][7]; });
      var a1 = Math.max.apply(null, las), a0 = Math.min.apply(null, las), o0 = Math.min.apply(null, los), o1 = Math.max.apply(null, los), pa = (a1 - a0) || .02, po = (o1 - o0) || .02;
      map = vis.map(function (x, i) { var d = x[0]; return '<button type="button" class="pin' + (i === st.sel ? ' on' : '') + '" data-store="' + i + '" style="left:' + (6 + 88 * (d[7] - o0) / po).toFixed(1) + '%;top:' + (6 + 88 * (a1 - d[6]) / pa).toFixed(1) + '%" aria-label="' + esc(d[0]) + '"><i><span>' + (i + 1) + '</span></i></button>'; }).join('');
    }
    out.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:24px"><div style="flex:1 1 380px;min-width:0;max-width:560px"><h2 class="disp" style="font-size:24px;margin-bottom:10px">' + vis.length + ' distributor' + (vis.length === 1 ? '' : 's') + ' within ' + st.r + ' km of ' + esc(g.label) + '</h2>' +
      '<div class="slist">' + (vis.length ? vis.map(function (x, i) { return card(x[0], i, x[1], i === st.sel); }).join('') : '<div class="empty">No distributors within ' + st.r + ' km. Try a larger distance.</div>') + '</div></div>' +
      '<div class="map" style="flex:2 1 500px;min-width:0" aria-label="Map of distributor locations"><div class="grid-bg"></div>' + map + '<div style="position:absolute;left:14px;bottom:12px;background:rgba(255,255,255,.92);border-radius:4px;padding:6px 10px;font-size:12px;color:var(--ink3)">Schematic map of nearby stockists.</div></div></div>';
  }
  wrap.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-rad]'))) { st.r = +b.getAttribute('data-rad'); st.sel = 0; render(); return; }
    if (e.target.closest('a')) return;
    if ((b = e.target.closest('[data-store]'))) { st.sel = +b.getAttribute('data-store'); render(); var c = $('.slist .store.on', wrap); if (c && c.scrollIntoView && b.classList.contains('pin')) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });
  $('[data-act="wtbform"]', wrap).addEventListener('submit', function (e) { e.preventDefault(); st.q = $('#wq').value; st.sel = 0; render(); });
  render();
  fetch(CFG.rest + 'stockists').then(function (r) { return r.json(); }).then(function (d) { DIST = d; render(); }).catch(function () { out.innerHTML = '<div class="empty">Could not load distributors. Please refresh the page.</div>'; });
}

/* ---------- Global events ---------- */
document.addEventListener('keydown', function (e) {
  if (e.target.id === 'q' && !$('#suggest').hidden) {
    if (e.key === 'ArrowDown' && moveSuggest(1)) { e.preventDefault(); return; }
    if (e.key === 'ArrowUp' && moveSuggest(-1)) { e.preventDefault(); return; }
    if (e.key === 'Enter' && sugSel > -1) { var a = $$('#suggest a')[sugSel]; if (a) { e.preventDefault(); location.href = a.href; return; } }
  }
  if (e.key === 'Escape') { closeMega(); hideSuggest(); var d = $('#drawer'); if (d && !d.hidden) { d.hidden = true; } }
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'q') { clearTimeout(sugT); sugT = setTimeout(suggest, 120); }
  if (e.target.hasAttribute('data-pfilter')) {
    var fq = e.target.value.trim().toLowerCase(), shown = 0;
    $$('#parts .prow').forEach(function (r) { var ok = !fq || r.getAttribute('data-ptext').indexOf(fq) > -1; r.hidden = !ok; if (ok) shown++; });
    $('#parts .pnone').hidden = shown > 0;
  }
});
document.addEventListener('focusin', function (e) { if (e.target.id === 'q') loadIndex(function () {}); });
document.addEventListener('click', function (e) {
  var t = e.target, b;
  if ((b = t.closest('.cb-item>button'))) { var s = b.parentNode.getAttribute('data-top'); if (b.parentNode.classList.contains('open')) closeMega(); else openMega(s); return; }
  if (!t.closest('.mega') && !t.closest('.cb-item')) closeMega();
  if (!t.closest('.search')) hideSuggest();
  if ((b = t.closest('[data-goslide]'))) { clearInterval(heroT); showSlide(+b.getAttribute('data-goslide')); return; }
  if ((b = t.closest('[data-thumb]'))) {
    var main = $('[data-main]'); if (main) { main.src = b.getAttribute('data-full'); main.removeAttribute('srcset'); }
    $$('[data-thumb]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    return;
  }
  if ((b = t.closest('[data-tab]'))) { showTab(b.getAttribute('data-tab'), !b.closest('[role=tablist]')); return; }
  if ((b = t.closest('[data-toc]'))) { var tg = document.getElementById(b.getAttribute('data-toc')); if (tg) tg.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if ((b = t.closest('[data-act="showpw"]'))) { var pw = $('#l-pw'); pw.type = pw.type === 'password' ? 'text' : 'password'; b.textContent = pw.type === 'password' ? 'Show' : 'Hide'; return; }
  if ((b = t.closest('[data-act="drawer"]'))) { var d = $('#drawer'); if (d) { d.hidden = false; b.setAttribute('aria-expanded', 'true'); var f = $('a', d); if (f) f.focus(); } return; }
  if (t.closest('[data-act="closedrawer"]')) { $('#drawer').hidden = true; var bg = $('.burger'); if (bg) bg.setAttribute('aria-expanded', 'false'); }
});

subList();
blogList();
toolsFilter();
wtb();
if (location.hash && /^#tp?-/.test(location.hash)) { showTab(location.hash.replace(/^#tp?-/, ''), true); }
window.WeldclassToast = toast;

/* ---------- Next.js additions: search box value and form notices from the address bar ---------- */
(function () {
  var qs = new URLSearchParams(location.search);
  var q = $('#q'); if (q && !q.value && qs.get('q') && location.pathname.indexOf('/search') === 0) q.value = qs.get('q');
  $$('[data-notice]').forEach(function (n) { if (qs.get(n.getAttribute('data-notice'))) n.hidden = false; });
  // Signed-in dealers: the header's "Dealer login" link becomes "Dealer portal".
  if (/(?:^|;\s*)wc_portal=1/.test(document.cookie)) {
    $$('a[href="/login/"]').forEach(function (l) { var t = l.querySelector('.lbl') || l; if (/dealer login/i.test(t.textContent)) { t.textContent = 'Dealer portal'; l.setAttribute('href', '/dealer/'); } });
  }
  // Copy buttons (distributor portal: account manager's mobile and email).
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { if (window.WeldclassToast) window.WeldclassToast('Copied'); });
  });
})();
})();
