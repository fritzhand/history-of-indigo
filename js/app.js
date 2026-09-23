/**
 * app.js — Indigo: A Global Commodity Autopsy
 *
 * A domain fork of the Downtown Tampa engine: same editorial furniture
 * (sticky era legend, scrollytelling map, year scrubber, sankeys, cited
 * tooltips, live source audit), re-pointed at a world map and a timeline
 * that runs from the fifth millennium BCE to the present.
 *
 * Sections:
 *   1. Constants & Helpers (palette, compressed time axis, citations)
 *   2. Progress Bar
 *   3. Era Legend
 *   4. Scrollytelling Map (Leaflet, world)
 *   5. Scroll Steps — Build & Observe
 *   6. Spread Map (the scrubber's map)
 *   7. Timeline Slider
 *   8. Sankey Drawing Engine (Custom SVG)
 *   9. Sankey Renders — Trade flows
 *  10. Chart.js Charts
 *  11. Tables — coerced labour, region matrix
 *  12. Plants, Photo Archive, Stat Blocks, Source Audit
 *  13. Theme, Resize, Main Init
 */

'use strict';

const D = () => window.indigoData || {};

/* The editorial data ramp. These literals are only the pre-stylesheet
   fallback: refreshTheme() reads the live values out of css/styles.css, so
   light and dark each get their own palette. */
const V = {
  v0:'#474C5C', v1:'#636A7D', v2:'#818899', v3:'#A4AABA',
  v4:'#BAC0CE', v5:'#8EA2F0', v6:'#C9B77A', v7:'#D9A45F',
  v8:'#DC8660', v9:'#E0645A'
};

/* The eight eras come from the data layer (meta.eras) in order; their colours
   come from the stylesheet (--era-<slug>). */
const ERAS = (D().meta && D().meta.eras) || [];
const PC = Object.fromEntries(ERAS.map(e => [e.slug, e.fallback || '#999']));
const ERA_LABEL = Object.fromEntries(ERAS.map(e => [e.slug, e.label || e.slug]));

function eraLabel(slug) { return ERA_LABEL[slug] || String(slug || ''); }

/* WCAG relative luminance of a #rrggbb fill, used to choose a legible label
   colour for era pills. */
function contrastInk(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#F8F7F3';
  const n = parseInt(m[1], 16);
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#0E1016' : '#F8F7F3';
}

/* Resolve a palette key from the data layer ("v9", "bengal") to the live
   colour for the current theme; anything unrecognised passes through. */
function paint(c, fallback) {
  if (!c) return fallback || V.v5;
  if (Object.prototype.hasOwnProperty.call(V, c))  return V[c];
  if (Object.prototype.hasOwnProperty.call(PC, c)) return PC[c];
  return c;
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex;
  return '#' + m[1] + Math.round(a * 255).toString(16).padStart(2, '0');
}

/* ── Compressed time ──
   Six thousand years on one linear axis would give the last five centuries,
   where almost all the trade happened, a sliver at the right edge. The
   scrubber and the spread chart therefore share a piecewise-linear scale
   declared in the data (meta.timeKnots: [[position, year], ...]). Each
   segment is linear; the tick labels say which year a position is. */
const KNOTS = (D().meta && D().meta.timeKnots) || [[0, -4500], [1000, 2025]];
const POS_MAX = KNOTS[KNOTS.length - 1][0];
const YEAR_MIN = KNOTS[0][1];
const YEAR_MAX = KNOTS[KNOTS.length - 1][1];

function yearOfPos(p) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [p0, y0] = KNOTS[i - 1], [p1, y1] = KNOTS[i];
    if (p <= p1) return Math.round(y0 + (y1 - y0) * (p - p0) / (p1 - p0));
  }
  return YEAR_MAX;
}
function posOfYear(y) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [p0, y0] = KNOTS[i - 1], [p1, y1] = KNOTS[i];
    if (y <= y1) return p0 + (p1 - p0) * (y - y0) / (y1 - y0);
  }
  return POS_MAX;
}

/* There is no year zero: 1 BCE is followed by 1 CE. Negative integers in the
   data are BCE years (-4200 = 4200 BCE). */
function fmtYear(y, { era = true } = {}) {
  if (y == null || Number.isNaN(y)) return '—';
  if (y < 0) return `${Math.abs(y).toLocaleString('en-US')} BCE`;
  if (y < 1000 && era) return `${y} CE`;
  return String(y);
}

/* Short tick labels: no thousands separator, and year 1 reads "1 CE". */
function axisYear(y) {
  if (y < 0) return `${Math.abs(y)} BCE`;
  if (y < 1000) return `${y} CE`;
  return String(y);
}

function eraOfYear(year) {
  let cur = ERAS[0] ? ERAS[0].slug : '';
  for (const e of ERAS) if (year >= e.start) cur = e.slug;
  return cur;
}

/* Nearest point in a year-keyed series, but never one that would be a lie:
   before a series begins there is no figure to show, and a point more than
   `maxGap` years away is too far to stand in for the requested year. */
function closestByYear(arr, year, { maxGap = 12 } = {}) {
  if (!arr || !arr.length) return null;
  const first = arr.reduce((m, d) => Math.min(m, d.year), Infinity);
  const last  = arr.reduce((m, d) => Math.max(m, d.year), -Infinity);
  if (year < first - 0.5 || year > last + maxGap) return null;
  const best = arr.reduce((b, c) => (Math.abs(c.year - year) < Math.abs(b.year - year) ? c : b));
  return Math.abs(best.year - year) > maxGap ? null : best;
}

Chart.defaults.font.family = "'Work Sans', system-ui, sans-serif";
Chart.defaults.font.size   = 10;

/* Theme tokens for canvas and SVG surfaces that CSS cannot reach. */
const T = {
  text:'#6C7285', textDim:'#7D8397', title:'#5A6074', grid:'#1E2230',
  tipBg:'#171A26', tipBorder:'#2A2F42', tipTitle:'#ECEEF5', tipBody:'#9AA0B3',
  sankeyLabel:'#B4B9C9', markerStroke:'rgba(255,255,255,0.35)', markerActive:'#ffffff'
};

const TIP = {
  backgroundColor:T.tipBg, borderColor:T.tipBorder, borderWidth:1,
  titleColor:T.tipTitle, bodyColor:T.tipBody, padding:12,
  titleFont:{ family:"'Work Sans',system-ui,sans-serif", weight:'600', size:12 },
  bodyFont:{ family:"'Work Sans',system-ui,sans-serif", size:10.5 },
  footerFont:{ family:"'Work Sans',system-ui,sans-serif", size:9.5, weight:'400' }
};

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function refreshTheme() {
  const light = currentTheme() === 'light';
  T.text         = cssVar('--text-faint', T.text);
  T.textDim      = cssVar('--text-dim', T.textDim);
  T.title        = cssVar('--text-muted', T.title);
  T.grid         = cssVar('--border-light', T.grid);
  T.tipBg        = cssVar('--bg-card', T.tipBg);
  T.tipBorder    = cssVar('--border', T.tipBorder);
  T.tipTitle     = cssVar('--text-primary', T.tipTitle);
  T.tipBody      = cssVar('--text-secondary', T.tipBody);
  T.sankeyLabel  = cssVar('--text-soft', T.sankeyLabel);
  T.markerStroke = light ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
  T.markerActive = light ? '#161A26' : '#ffffff';
  for (let i = 0; i <= 9; i++) V['v' + i] = cssVar('--v' + i, V['v' + i]);
  for (const e of ERAS) PC[e.slug] = cssVar('--era-' + e.slug, PC[e.slug]);
  Chart.defaults.color       = T.text;
  Chart.defaults.borderColor = T.grid;
  Object.assign(TIP, { backgroundColor:T.tipBg, borderColor:T.tipBorder, titleColor:T.tipTitle, bodyColor:T.tipBody });
}

function mkScale(overrides = {}) {
  return {
    grid:  { color:T.grid },
    ticks: { color:T.text, font:{ family:"'Work Sans',system-ui,sans-serif", size:10 } },
    ...overrides
  };
}

function axisTitle(text) {
  return { display:true, text, color:T.title, font:{ size:10 } };
}

/* Linear year axis: no thousands separators on years ("1,900" → "1900"). */
function yearScale(overrides = {}) {
  const s = mkScale({ type:'linear', title:axisTitle('Year'), ...overrides });
  s.ticks = { ...s.ticks, callback: v => String(v) };
  return s;
}

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(Math.abs(n) >= 1e7 ? 0 : 1) + 'M';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  return String(Math.round(n * 100) / 100);
}

/* Basemap — key-free Esri canvas tiles, dark and light. */
const BASEMAPS = {
  dark: {
    base:  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    label: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
  },
  light: {
    base:  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    label: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
  },
  attribution: 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxNativeZoom: 16,
  maxZoom: 12
};

const _basemapLayers = new Map();

function addBasemap(map) {
  const urls = BASEMAPS[currentTheme()];
  const prev = _basemapLayers.get(map);
  if (prev) { map.removeLayer(prev.base); map.removeLayer(prev.label); }
  const base = L.tileLayer(urls.base, {
    attribution: BASEMAPS.attribution,
    maxNativeZoom: BASEMAPS.maxNativeZoom, maxZoom: BASEMAPS.maxZoom
  }).addTo(map);
  const label = L.tileLayer(urls.label, {
    maxNativeZoom: BASEMAPS.maxNativeZoom, maxZoom: BASEMAPS.maxZoom, opacity: 0.8
  }).addTo(map);
  _basemapLayers.set(map, { base, label });
}

/* Citation helpers. A `source` may be one source object
   { institution, title, date, url, note, verificationStatus, accessType }
   or an array of them. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

function statusBadge(status) {
  if (!status) return '';
  const s = String(status).toUpperCase();
  return `<span class="src-badge src-${s.toLowerCase()}" title="Verification status: ${s}">${s}</span>`;
}

function sourceHtml(src, { badge = true } = {}) {
  if (!src) return '';
  if (Array.isArray(src)) return src.map(s => sourceHtml(s, { badge })).filter(Boolean).join(' · ');
  if (typeof src === 'string') return esc(src);
  const label = esc(src.institution || src.label || src.url || 'Source');
  const tip   = src.title ? ` title="${esc(src.title)}"` : '';
  const link  = src.url
    ? `<a href="${esc(src.url)}" target="_blank" rel="noopener"${tip}>${label}</a>`
    : label;
  const date  = src.date ? ` (${esc(src.date)})` : '';
  return link + date + (badge ? ' ' + statusBadge(src.verificationStatus) : '');
}

/* Tooltip footer lines for one data point. */
function pointFooter(d) {
  if (!d) return '';
  const lines = [];
  const note = d.note || (d.source && !Array.isArray(d.source) && d.source.note);
  if (note) lines.push(...wrap(note, 60));
  const one = Array.isArray(d.source) ? d.source[0] : d.source;
  const status = one && one.verificationStatus;
  const flags = [d.estimate ? 'estimate' : null, status && status !== 'CONFIRMED' ? status : null].filter(Boolean);
  if (flags.length) lines.push('Status: ' + flags.join(' · '));
  if (one && one.institution) lines.push(...wrap('Source: ' + one.institution + (one.date ? ', ' + one.date : ''), 60));
  return lines;
}

function wrap(text, n) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > n) { if (cur) out.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/* Print a section's own source line into a footer element, so a DERIVED
   model always announces itself rather than hiding behind a tidy caption. */
function renderSourceLine(elId, source, prefix = 'Source: ') {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!source) { el.textContent = ''; return; }
  const one = Array.isArray(source) ? source[0] : source;
  const note = one && one.note ? `<span class="chart-source-note">${esc(one.note)}</span>` : '';
  el.innerHTML = prefix + sourceHtml(source) + note;
}

/* Every institution behind a series, printed once. A run of annual volumes
   from one archive (thirty Government of India statistics scans, say) is one
   entry with a count, not thirty links; each point's own tooltip still names
   its exact volume. */
function seriesSourceLine(elId, rows, prefix = 'Sources: ') {
  const el = document.getElementById(elId);
  if (!el) return;
  const byInst = new Map();
  (rows || []).forEach(r => {
    [].concat(r.source || []).forEach(s => {
      if (!s || !s.url) return;
      const k = (s.institution || s.url) + '|' + s.verificationStatus;
      const e = byInst.get(k) || { s, urls: new Set() };
      e.urls.add(s.url);
      byInst.set(k, e);
    });
  });
  el.innerHTML = byInst.size ? prefix + [...byInst.values()].map(({ s, urls }) =>
    sourceHtml({ ...s, date: urls.size > 1 ? `${urls.size} documents` : s.date })).join(' · ') : '';
}

function series(id) {
  const s = (D().series || {})[id];
  return s ? s.points || [] : [];
}
function seriesMeta(id) { return (D().series || {})[id] || null; }

/* ═══════════════════════════════════════════════════════════════
   2. PROGRESS BAR
═══════════════════════════════════════════════════════════════ */
function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const dH = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${dH > 0 ? Math.min(window.scrollY / dH, 1) : 0})`;
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════
   3. ERA LEGEND
═══════════════════════════════════════════════════════════════ */
function buildPhaseLegend() {
  const c = document.getElementById('phase-pills-container');
  if (!c) return;
  c.innerHTML = '';
  ERAS.forEach(e => {
    const color = PC[e.slug];
    const ink = contrastInk(color);
    const el = document.createElement('a');
    el.className = 'phase-pill';
    el.dataset.phase = e.slug;
    el.href = '#scrollytelling';
    el.title = `${e.label}, ${fmtYear(e.start)} – ${e.end == null ? 'today' : fmtYear(e.end)}: jump to it in the narrative`;
    el.style.cssText = `background:${color};color:${ink}`;
    el.innerHTML = `<span class="dot" style="background:${ink}"></span>${esc(e.label)}`;
    el.addEventListener('click', ev => { ev.preventDefault(); scrollToPhase(e.slug); });
    c.appendChild(el);
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function navHeight() {
  return document.getElementById('main-nav')?.offsetHeight || 56;
}

function legendHeight() {
  return document.getElementById('phase-legend')?.offsetHeight || 46;
}

function stickyOffset() {
  const legend = document.getElementById('phase-legend');
  const stuck = legend && getComputedStyle(legend).position === 'sticky' && legend.offsetHeight > 0;
  return navHeight() + (stuck ? legend.offsetHeight : 0);
}

function setLayoutVars() {
  document.documentElement.style.setProperty('--nav-h', navHeight() + 'px');
  document.documentElement.style.setProperty('--legend-h', legendHeight() + 'px');
}

function stepForPhase(phase) {
  const exact = document.querySelector(`.scroll-step[data-phase="${phase}"]`);
  if (exact) return exact;
  const order = ERAS.map(e => e.slug);
  const want  = order.indexOf(phase);
  if (want === -1) return null;
  let best = null, bestDist = Infinity;
  document.querySelectorAll('.scroll-step').forEach(s => {
    const oi = order.indexOf(s.dataset.phase);
    if (oi === -1) return;
    const dist = Math.abs(oi - want);
    if (dist < bestDist) { best = s; bestDist = dist; }
  });
  return best;
}

function scrollToPhase(phase) {
  const target = stepForPhase(phase) || document.getElementById('scrollytelling');
  if (!target) return;
  const isStep = target.classList.contains('scroll-step');
  const mapH   = (isStep && window.innerWidth <= 900) ? (document.querySelector('.sticky-figure')?.offsetHeight || 0) : 0;
  const y = target.getBoundingClientRect().top + window.scrollY - navHeight() - legendHeight() - mapH - 16;
  if (isStep) lockScrollyStep(target);
  window.scrollTo({ top: Math.max(y, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function highlightPhasePill(phase) {
  const scroller = document.getElementById('phase-legend');
  document.querySelectorAll('#phase-pills-container .phase-pill').forEach(p => {
    const on = p.dataset.phase === phase;
    p.classList.toggle('is-current', on);
    if (on && scroller && scroller.scrollWidth > scroller.clientWidth + 4) {
      const cRect = scroller.getBoundingClientRect();
      const pRect = p.getBoundingClientRect();
      const left  = scroller.scrollLeft + (pRect.left - cRect.left) - (cRect.width / 2) + (pRect.width / 2);
      scroller.scrollTo({ left: Math.max(left, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  });
  const ind = document.getElementById('nav-phase-indicator');
  if (ind) {
    const color = PC[phase];
    ind.innerHTML = color
      ? `<span class="nav-phase-pill" style="background:${color};color:${contrastInk(color)}">${esc(eraLabel(phase))}</span>`
      : '';
  }
}

/* ═══════════════════════════════════════════════════════════════
   4. SCROLLYTELLING MAP
═══════════════════════════════════════════════════════════════ */
let scrollMap     = null;
const scrollMkrs  = {};
let prevActiveId  = null;

function popupHtml(ev) {
  return `<div class="map-popup-date" style="color:${PC[ev.phase] || V.v5}">${esc(ev.date)} · ${esc(eraLabel(ev.phase))}</div>` +
    `<div class="map-popup-title">${esc(ev.title)}</div>` +
    (ev.place ? `<div class="map-popup-place">${esc(ev.place)}</div>` : '') +
    `<div class="map-popup-body">${esc(ev.body)}</div>` +
    `<div class="map-popup-source">${sourceHtml(ev.source)}</div>`;
}

function initScrollMap() {
  const el = document.getElementById('scroll-map-container');
  if (!el || typeof L === 'undefined') return;

  const m = D().meta || {};
  scrollMap = L.map('scroll-map-container', {
    center: m.center || [22, 30], zoom: m.defaultZoom || 2, minZoom: 1,
    zoomControl:false, scrollWheelZoom:false, worldCopyJump:true,
    dragging:false, touchZoom:false, doubleClickZoom:false, keyboard:false
  });
  addBasemap(scrollMap);

  (D().mapEvents || []).forEach(ev => {
    const color = PC[ev.phase] || V.v3;
    const mk = L.circleMarker([ev.lat, ev.lng], {
      radius:4.5, fillColor:color,
      color:T.markerStroke, weight:1,
      fillOpacity:0.8, opacity:1
    }).bindPopup(popupHtml(ev), { maxWidth:280 }).addTo(scrollMap);
    scrollMkrs[ev.id] = { m: mk, phase: ev.phase };
  });
}

function activateMapStep(step) {
  if (!scrollMap) return;

  if (prevActiveId && scrollMkrs[prevActiveId]) {
    const p = scrollMkrs[prevActiveId];
    p.m.setRadius(4.5);
    p.m.setStyle({ fillOpacity:0.8, weight:1, color:T.markerStroke });
  }

  const ev = (D().mapEvents || []).find(e => e.id === step.eventId);
  if (ev && scrollMkrs[ev.id]) {
    const cur = scrollMkrs[ev.id];
    cur.m.setRadius(11);
    cur.m.setStyle({ fillOpacity:1, weight:2.5, color:T.markerActive });
    cur.m.bringToFront();
    prevActiveId = ev.id;
  }

  const to = step.flyTo || (ev ? [ev.lat, ev.lng] : null);
  if (to) scrollMap.flyTo(to, step.zoom || 4, { animate:!prefersReducedMotion(), duration:1.2 });
}

/* ═══════════════════════════════════════════════════════════════
   5. SCROLL STEPS
═══════════════════════════════════════════════════════════════ */
function dropStepFigure(img) {
  const fig = img.closest('.step-figure');
  const box = fig && fig.parentElement;
  if (fig) fig.remove();
  if (box && box.querySelectorAll('.step-figure').length < 2) box.classList.remove('is-pair');
  if (box && !box.querySelector('.step-figure')) box.remove();
}
window.dropStepFigure = dropStepFigure;

function mediaById(id) {
  const idx = mediaById._index ||
    (mediaById._index = new Map((D().mediaAssets || []).map(a => [a.id, a])));
  return idx.get(id);
}

function stepMediaHtml(step) {
  const items = (step.media || []).map(mediaById).filter(Boolean);
  if (!items.length) return '';
  const figures = items.map(a => `
    <figure class="step-figure">
      <a class="step-figure-link" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener"
         title="${esc(a.title)} — open the source record">
        <img class="step-figure-img" src="${esc(a.thumbUrl)}" alt="${esc(a.alt || a.title)}"
             loading="lazy" decoding="async" referrerpolicy="no-referrer"
             onerror="dropStepFigure(this)" />
      </a>
      <figcaption class="step-figure-cap">
        <span class="step-figure-title">${esc(a.title)}</span>
        <span class="step-figure-year">${esc(a.year)}</span>
        <span class="step-figure-credit">${esc(a.creditLine || '')}</span>
      </figcaption>
    </figure>`).join('');
  return `<div class="step-figures${items.length > 1 ? ' is-pair' : ''}">${figures}</div>`;
}

/* How many mapped centres of indigo use exist by a given year. A count of
   this site's own map layer, not of the world: it says how much of the
   story has happened, and is labelled that way wherever it is shown. */
function centresBy(year) {
  return (D().mapEvents || []).filter(e => e.year <= year).length;
}
function continentsBy(year) {
  return new Set((D().mapEvents || []).filter(e => e.year <= year && e.continent).map(e => e.continent)).size;
}

function buildScrollSteps() {
  const container = document.getElementById('scroll-steps-container');
  if (!container) return;
  const evById = new Map((D().mapEvents || []).map(e => [e.id, e]));

  (D().scrollSteps || []).forEach((step, idx) => {
    const color = PC[step.phase] || V.v3;
    const ev = evById.get(step.eventId) || {};
    const chips = (step.chips || []).map(c =>
      `<div class="step-metric-chip">${esc(c.label)} <strong>${esc(c.value)}</strong></div>`).join('');
    const el = document.createElement('div');
    el.className = 'scroll-step';
    el.dataset.idx = idx;
    el.dataset.phase = step.phase || '';
    el.style.borderLeftColor = color;
    el.innerHTML = `
      <div class="step-phase-date" style="color:${color}">
        ${esc(step.date)}&nbsp;&nbsp;·&nbsp;&nbsp;${esc(eraLabel(step.phase))}
      </div>
      <h3 class="step-headline">${esc(step.headline)}</h3>
      ${ev.place ? `<p class="step-place">${esc(ev.place)}</p>` : ''}
      <p class="step-narrative">${esc(step.narrative)}</p>
      ${stepMediaHtml(step)}
      ${chips ? `<div class="step-metrics">${chips}</div>` : ''}
      <p class="step-source">${sourceHtml(ev.source)}</p>`;
    container.appendChild(el);
  });
}

let setActiveStep    = null;
let _scrollyObserver = null;
let _navScrollLock   = false;
let _navLockTimer    = null;
let _navLockRelease  = null;

function lockScrollyStep(target) {
  _navScrollLock = true;
  if (target && typeof setActiveStep === 'function') setActiveStep(target);
  if (_navLockRelease) window.removeEventListener('scrollend', _navLockRelease);
  clearTimeout(_navLockTimer);
  _navLockRelease = () => {
    clearTimeout(_navLockTimer);
    window.removeEventListener('scrollend', _navLockRelease);
    _navLockRelease = null;
    const cur = document.querySelector('.scroll-step.is-active');
    if (target && cur !== target && typeof setActiveStep === 'function') setActiveStep(target);
    _navScrollLock = false;
  };
  window.addEventListener('scrollend', _navLockRelease);
  _navLockTimer = setTimeout(_navLockRelease, 1600);
}

/* The page is still settling while a jump is in flight (charts lay out,
   lazy figures load), so re-assert the destination for a short window. */
let _jumpStop = null;
function scrollToSection(target) {
  const destOf = () => Math.max(target.getBoundingClientRect().top + window.scrollY - stickyOffset() - 8, 0);
  const smooth = !prefersReducedMotion();
  window.scrollTo({ top: destOf(), behavior: smooth ? 'smooth' : 'auto' });
  if (!smooth) return;

  if (_jumpStop) _jumpStop();
  let settled = false;
  const snap = () => {
    const want = destOf();
    if (Math.abs(window.scrollY - want) > 8) window.scrollTo({ top: want, behavior: 'auto' });
  };
  const onSettle = () => { settled = true; snap(); };
  const ro = ('ResizeObserver' in window)
    ? new ResizeObserver(() => { if (settled) snap(); })
    : null;
  ro && ro.observe(document.body);
  window.addEventListener('scrollend', onSettle);
  const t1 = setTimeout(onSettle, 900);
  const t2 = setTimeout(snap, 1600);
  const stop = setTimeout(() => _jumpStop && _jumpStop(), 2600);

  _jumpStop = () => {
    clearTimeout(t1); clearTimeout(t2); clearTimeout(stop);
    window.removeEventListener('scrollend', onSettle);
    ro && ro.disconnect();
    _jumpStop = null;
  };
  window.addEventListener('wheel',      () => _jumpStop && _jumpStop(), { once: true, passive: true });
  window.addEventListener('touchstart', () => _jumpStop && _jumpStop(), { once: true, passive: true });
}

function initAnchorScroll() {
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.closest('#nav-drawer') || a.classList.contains('phase-pill')) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (id === 'scrollytelling') { scrollToPhase(ERAS[0] && ERAS[0].slug); }
    else { scrollToSection(target); }
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });
}

/* Section drawer, built from the page's own sections. */
function initNavDrawer() {
  const btn    = document.getElementById('nav-toggle');
  const drawer = document.getElementById('nav-drawer');
  const scrim  = document.getElementById('nav-scrim');
  const list   = document.getElementById('nav-drawer-list');
  if (!btn || !drawer || !scrim || !list) return;

  const NAMES = {
    hero: 'Top of the page',
    scrollytelling: 'The narrative map',
    about: 'About this project',
    'resolution-footer': 'Closing figures',
  };
  const buildList = () => {
    const secs = Array.from(document.querySelectorAll('section[id], footer[id]'))
      .filter(el => !el.hasAttribute('hidden'));
    list.innerHTML = secs.map((el, i) => {
      const kicker = el.querySelector('.section-eyebrow, .pathways-kicker')?.textContent.trim().replace(/\s+/g, ' ');
      const title  = el.querySelector('.section-title, .footer-title')?.textContent.trim().replace(/\s+/g, ' ');
      const label  = NAMES[el.id] || kicker || title || el.id;
      return `<a class="nav-drawer-link" href="#${esc(el.id)}" data-target="${esc(el.id)}"` +
             (title ? ` title="${esc(title)}"` : '') +
             `><span class="nav-drawer-num">${String(i + 1).padStart(2, '0')}</span>` +
             `<span>${esc(label)}</span></a>`;
    }).join('');
  };
  buildList();

  const isOpen = () => document.body.classList.contains('nav-open');

  const open = () => {
    buildList();
    markCurrent();
    document.body.dataset.navLockY = String(window.scrollY || 0);
    document.body.classList.add('nav-open');
    scrim.hidden = false;
    drawer.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close the section menu');
    drawer.querySelector('.nav-drawer-link')?.focus({ preventScroll: true });
  };

  const close = ({ restore = true } = {}) => {
    if (!isOpen()) return;
    document.body.classList.remove('nav-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open the section menu');
    const y = parseInt(document.body.dataset.navLockY || '0', 10);
    if (restore) window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    setTimeout(() => {
      if (isOpen()) return;
      scrim.hidden = true;
      drawer.hidden = true;
    }, 260);
  };

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  scrim.addEventListener('click', () => close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  list.addEventListener('click', e => {
    const a = e.target.closest('.nav-drawer-link');
    if (!a) return;
    e.preventDefault();
    const target = document.getElementById(a.dataset.target);
    close({ restore: false });
    if (!target) return;
    if (target.id === 'scrollytelling') { scrollToPhase(ERAS[0] && ERAS[0].slug); return; }
    scrollToSection(target);
  });

  function markCurrent() {
    const mid = window.scrollY + window.innerHeight * 0.35;
    let best = null;
    for (const a of list.querySelectorAll('.nav-drawer-link')) {
      const el = document.getElementById(a.dataset.target);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= mid) best = a;
    }
    list.querySelectorAll('.nav-drawer-link').forEach(a => a.classList.toggle('is-current', a === best));
  }
  window.addEventListener('scroll', () => { if (isOpen()) markCurrent(); }, { passive: true });
}

/* Floating scroll assist: section to section, and step by step through the
   narrative so the sticky map is never jumped past in one leap. */
function initSectionNav() {
  const nav  = document.getElementById('section-nav');
  const up   = document.getElementById('section-nav-up');
  const down = document.getElementById('section-nav-down');
  if (!nav || !up || !down) return;

  const targets = () =>
    Array.from(document.querySelectorAll('#hero, section[id], footer[id], .scroll-step'))
         .filter(el => el.id !== 'scrollytelling' || true)
         .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);

  const readingOffset = el => {
    if (el.classList.contains('scroll-step') && window.innerWidth <= 900) {
      const fig = document.querySelector('.sticky-figure');
      return stickyOffset() + (fig?.offsetHeight || 0) + 14;
    }
    return stickyOffset() + 8;
  };

  const destOf    = el => el.getBoundingClientRect().top + window.scrollY - readingOffset(el);
  const scrollToY = y  => window.scrollTo({ top: Math.max(y, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

  const goTo = t => {
    if (!t) return;
    if (t.el.classList.contains('scroll-step')) lockScrollyStep(t.el);
    scrollToY(t.y);
  };

  down.addEventListener('click', () => {
    const next = targets().map(el => ({ el, y: destOf(el) }))
      .filter(o => o.y > window.scrollY + 24).sort((a, b) => a.y - b.y)[0];
    next ? goTo(next) : scrollToY(document.body.scrollHeight);
  });

  up.addEventListener('click', () => {
    const prev = targets().map(el => ({ el, y: destOf(el) }))
      .filter(o => o.y < window.scrollY - 24).sort((a, b) => b.y - a.y)[0];
    prev ? goTo(prev) : scrollToY(0);
  });

  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-visible', y > window.innerHeight * 0.45);
    up.classList.toggle('is-disabled', y <= 24);
    down.classList.toggle('is-disabled', (window.innerHeight + y) >= document.body.scrollHeight - 4);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function scrollyRootMargin() {
  if (window.innerWidth <= 900) {
    const fig    = document.querySelector('.sticky-figure');
    const top    = navHeight() + legendHeight() + (fig?.offsetHeight || 0);
    const bottom = Math.max(window.innerHeight - top - Math.round(window.innerHeight * 0.22), 60);
    return `-${top}px 0px -${bottom}px 0px`;
  }
  return '-8% 0px -28% 0px';
}

function initScrollytelling() {
  const steps = document.querySelectorAll('.scroll-step');
  if (!steps.length) return;

  const oDate     = document.getElementById('map-overlay-date');
  const oHeadline = document.getElementById('map-overlay-headline');
  const oCentres  = document.getElementById('map-overlay-centres');
  const oConts    = document.getElementById('map-overlay-continents');
  const evById    = new Map((D().mapEvents || []).map(e => [e.id, e]));

  setActiveStep = target => {
    const idx  = +target.dataset.idx;
    const step = (D().scrollSteps || [])[idx];
    if (!step) return;
    steps.forEach(s => s.classList.remove('is-active'));
    target.classList.add('is-active');
    highlightPhasePill(step.phase);
    activateMapStep(step);
    const ev = evById.get(step.eventId);
    const y  = ev ? ev.year : null;
    if (oDate)     oDate.textContent     = `${step.date} · ${eraLabel(step.phase)}`;
    if (oHeadline) oHeadline.textContent = step.headline;
    if (oCentres && y != null)  oCentres.textContent  = String(centresBy(y));
    if (oConts && y != null)    oConts.textContent    = String(continentsBy(y));
  };

  const build = () => {
    if (_scrollyObserver) _scrollyObserver.disconnect();
    _scrollyObserver = new IntersectionObserver(entries => {
      if (_navScrollLock) return;
      entries.forEach(entry => { if (entry.isIntersecting) setActiveStep(entry.target); });
    }, { threshold: 0, rootMargin: scrollyRootMargin() });
    steps.forEach(s => _scrollyObserver.observe(s));
  };
  build();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { setLayoutVars(); build(); }, 200);
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════
   6. SPREAD MAP — every mapped centre, revealed as the year advances
═══════════════════════════════════════════════════════════════ */
let sandboxMap = null;
const sandboxMkrs = [];
let _latestSandboxId = null;

function restyleMarkers() {
  Object.values(scrollMkrs).forEach(({ m, phase }) => {
    const active = prevActiveId && scrollMkrs[prevActiveId] && scrollMkrs[prevActiveId].m === m;
    m.setStyle({ fillColor: PC[phase] || V.v3, color: active ? T.markerActive : T.markerStroke });
  });
  sandboxMkrs.forEach(({ m, ev }) => m.setStyle({
    fillColor: PC[ev.phase] || V.v3,
    color: ev.id === _latestSandboxId ? T.markerActive : T.markerStroke
  }));
}

function initSandboxMap() {
  const el = document.getElementById('sandbox-map-container');
  if (!el || typeof L === 'undefined') return;

  sandboxMap = L.map('sandbox-map-container', {
    center: [20, 25], zoom: 1, minZoom: 1,
    zoomControl:true, scrollWheelZoom:false, worldCopyJump:true
  });
  addBasemap(sandboxMap);

  [...(D().mapEvents || [])].sort((a, b) => a.year - b.year).forEach(ev => {
    const m = L.circleMarker([ev.lat, ev.lng], {
      radius:5, fillColor:PC[ev.phase] || V.v3,
      color:T.markerStroke, weight:1, fillOpacity:0, opacity:0
    }).bindPopup(popupHtml(ev), { maxWidth:260 });
    m.addTo(sandboxMap);
    sandboxMkrs.push({ m, ev, shown:false });
  });
}

function updateSandboxMap(year) {
  if (!sandboxMap) return;
  let latest = null;
  sandboxMkrs.forEach(o => {
    const on = o.ev.year <= year;
    if (on) latest = o;
    if (on !== o.shown) {
      o.m.setStyle({ fillOpacity: on ? 0.85 : 0, opacity: on ? 1 : 0 });
      o.m.options.interactive = on;
      if (o.m._path) o.m._path.style.pointerEvents = on ? '' : 'none';
      o.shown = on;
    }
    o.m.setRadius(5);
    o.m.setStyle({ weight: 1, color: T.markerStroke });
  });
  if (latest) {
    latest.m.setRadius(10);
    latest.m.setStyle({ weight: 2.5, color: T.markerActive });
    latest.m.bringToFront();
  }
  _latestSandboxId = latest ? latest.ev.id : null;
}

/* ═══════════════════════════════════════════════════════════════
   7. TIMELINE SLIDER (compressed time)
═══════════════════════════════════════════════════════════════ */
function paintSliderTrack() {
  const slider = document.getElementById('era-slider');
  if (!slider) return;
  const stops = ERAS.map((e, i) => {
    const a = posOfYear(Math.max(e.start, YEAR_MIN)) / POS_MAX * 100;
    const b = (i < ERAS.length - 1 ? posOfYear(ERAS[i + 1].start) : POS_MAX) / POS_MAX * 100;
    return `${PC[e.slug]} ${a.toFixed(2)}% ${b.toFixed(2)}%`;
  });
  slider.style.setProperty('--slider-track', `linear-gradient(to right, ${stops.join(', ')})`);
}

function buildSliderTicks() {
  const box = document.getElementById('slider-ticks');
  if (!box) return;
  const ticks = (D().meta && D().meta.sliderTicks) || [];
  box.innerHTML = ticks.map(t =>
    `<span style="left:${(posOfYear(t.year) / POS_MAX * 100).toFixed(2)}%">${esc(t.label)}</span>`).join('');
}

function buildSliderCards() {
  const box = document.getElementById('stat-cards');
  if (!box || box.dataset.built) return;
  box.dataset.built = '1';
  ((D().meta && D().meta.sliderCards) || []).forEach(c => {
    const col = `var(--${/^v\d$/.test(c.color) ? c.color : 'era-' + c.color})`;
    const el = document.createElement('div');
    el.className = 'stat-card';
    el.style.borderLeftColor = col;
    el.innerHTML = `<div class="stat-card-value" id="${esc(c.id)}" style="color:${col}">—</div>
      <div class="stat-card-label">${esc(c.label)}</div>
      <div class="stat-card-asof" id="${esc(c.id)}-asof"></div>`;
    box.appendChild(el);
  });
}

function initSlider() {
  const slider = document.getElementById('era-slider');
  if (!slider) return;
  buildSliderCards();
  slider.max = POS_MAX;
  const startYear = (D().meta && D().meta.sliderStartYear) || YEAR_MIN;
  slider.value = Math.round(posOfYear(startYear));
  slider.addEventListener('input', () => updateSlider(+slider.value), { passive:true });
  paintSliderTrack();
  buildSliderTicks();
  updateSlider(+slider.value);
}

function updateSlider(pos) {
  const year = yearOfPos(pos);
  const era  = eraOfYear(year);
  const slider = document.getElementById('era-slider');
  if (slider) slider.setAttribute('aria-valuetext', fmtYear(year));

  const dEl = document.getElementById('slider-date-label');
  if (dEl) dEl.textContent = fmtYear(year);

  const badge = document.getElementById('era-badge');
  if (badge) {
    badge.textContent = `Era: ${eraLabel(era)}`;
    badge.style.color = PC[era] || V.v5;
  }

  const set = (id, point, value, emptyText) => {
    const e = document.getElementById(id);
    if (e) e.textContent = point ? value : '—';
    const a = document.getElementById(id + '-asof');
    if (!a) return;
    if (!point) {
      a.textContent = emptyText || 'no series for this year';
      a.className = 'stat-card-asof is-empty';
      return;
    }
    if (point === true) { a.textContent = `by ${fmtYear(year)}`; a.className = 'stat-card-asof'; return; }
    const gap = Math.abs(point.year - year);
    const one = Array.isArray(point.source) ? point.source[0] : point.source;
    const est = point.estimate || (one && one.verificationStatus === 'DERIVED');
    a.textContent = (gap === 0 ? `${fmtYear(point.year)}` : `as of ${fmtYear(point.year)}`) + (est ? ' · est.' : '');
    a.className = 'stat-card-asof' + (gap > 4 ? ' is-far' : '');
  };

  set('stat-centres', true, String(centresBy(year)));
  set('stat-continents', true, String(continentsBy(year)));

  const cards = (D().meta && D().meta.sliderCards) || [];
  cards.forEach(c => {
    const s = series(c.series);
    const p = closestByYear(s, year, { maxGap: c.maxGap ?? 3 });
    const fmt = v => (c.prefix || '') + fmtNum(v) + (c.suffix || '');
    set(c.id, p, p ? fmt(p.value) : '—', year < (s[0] ? s[0].year : 0) ? 'series not begun' : 'no figure within ' + (c.maxGap ?? 3) + ' yrs');
  });

  const evs = [...(D().mapEvents || [])].filter(e => e.year <= year).sort((a, b) => a.year - b.year);
  const ev  = evs[evs.length - 1];
  const evH = document.getElementById('sandbox-event-headline');
  const evB = document.getElementById('sandbox-event-body');
  if (ev) {
    if (evH) evH.textContent = `${ev.date} · ${ev.title}`;
    if (evB) evB.textContent = ev.body;
  } else {
    if (evH) evH.textContent = 'Before the first surviving evidence';
    if (evB) evB.textContent = 'No indigo-dyed object older than this has yet been found. Drag the slider forward.';
  }

  updateSandboxMap(year);
  for (const ch of [_spreadMarkerChart, _centresChart]) {
    if (!ch) continue;
    ch.options.plugins.yearLine.pos = pos;
    ch.update('none');
  }
  for (const ch of _yearLineCharts) {
    ch.options.plugins.yearLine.pos = year;
    ch.update('none');
  }
}

/* ═══════════════════════════════════════════════════════════════
   8. SANKEY ENGINE
═══════════════════════════════════════════════════════════════ */
function drawSankey(svgId, model) {
  const { nodes, links } = model;
  const svgEl = document.getElementById(svgId);
  if (!svgEl) return;

  const W  = Math.max(svgEl.parentElement?.clientWidth || 0, 680);
  const H  = parseInt(svgEl.style.height) || 380;
  const PAD = { top:28, right:150, bottom:10, left:10 };
  const NW  = 14;
  const NG  = 9;

  const numCols = Math.max(...nodes.map(n => n.col)) + 1;
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top  - PAD.bottom;
  const colSpan = iW / Math.max(numCols - 1, 1);

  const nd = nodes.map((n, i) => ({ ...n, idx:i, inV:0, outV:0, val:0 }));
  links.forEach(lk => { nd[lk.source].outV += lk.value; nd[lk.target].inV += lk.value; });
  nd.forEach(n => {
    n.val = n.col === 0            ? n.outV
          : n.col === numCols - 1  ? n.inV
          : Math.max(n.inV, n.outV);
  });

  const byCol = {};
  nd.forEach(n => (byCol[n.col] = byCol[n.col] || []).push(n));

  /* One value-to-pixel scale for the whole diagram, taken from the fullest
     column, so a band is as thick as the node it leaves. */
  let k = Infinity;
  for (let c = 0; c < numCols; c++) {
    const cns = byCol[c] || [];
    const tot = cns.reduce((s, n) => s + n.val, 0) || 1;
    k = Math.min(k, (iH - NG * Math.max(cns.length - 1, 0)) / tot);
  }

  const pos = {};
  for (let c = 0; c < numCols; c++) {
    const cns  = byCol[c] || [];
    const xBase  = c === numCols - 1 ? PAD.left + iW - NW : PAD.left + c * colSpan;
    let y = PAD.top;
    cns.forEach(n => {
      const h = Math.max(n.val * k, 4);
      pos[n.idx] = { x:xBase, y, h, midY: y + h / 2, outY: y, inY: y, color: paint(n.color, T.textDim) };
      y += h + NG;
    });
  }

  const NS = 'http://www.w3.org/2000/svg';
  svgEl.innerHTML = '';
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.setAttribute('width', W);
  svgEl.setAttribute('height', H);

  (model.headers || []).slice(0, numCols).forEach((h, c) => {
    const t = document.createElementNS(NS, 'text');
    const x = c === numCols - 1 ? PAD.left + iW : PAD.left + c * colSpan;
    t.setAttribute('x', x);
    t.setAttribute('y', 14);
    t.setAttribute('text-anchor', c === numCols - 1 ? 'end' : 'start');
    t.setAttribute('class', 'sankey-col-header');
    t.textContent = h;
    svgEl.appendChild(t);
  });

  const linkGroup = document.createElementNS(NS, 'g');
  links.forEach(lk => {
    const s = pos[lk.source], t = pos[lk.target];
    if (!s || !t) return;
    const w = Math.max(lk.value * k, 1.5);
    const y0 = s.outY + w / 2; s.outY += w;
    const y1 = t.inY + w / 2;  t.inY += w;
    const x0 = s.x + NW, x1 = t.x;
    const mid = (x0 + x1) / 2;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1}`);
    path.setAttribute('stroke', s.color);
    path.setAttribute('stroke-opacity', '0.32');
    path.setAttribute('stroke-width', w);
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'sankey-link');
    const title = document.createElementNS(NS, 'title');
    title.textContent = `${nodes[lk.source].name} → ${nodes[lk.target].name}: ${lk.value}${lk.unit ? ' ' + lk.unit : ''}`;
    path.appendChild(title);
    linkGroup.appendChild(path);
  });
  svgEl.appendChild(linkGroup);

  nd.forEach(n => {
    const p = pos[n.idx];
    if (!p) return;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', p.x);
    rect.setAttribute('y', p.y);
    rect.setAttribute('width', NW);
    rect.setAttribute('height', p.h);
    rect.setAttribute('rx', 2);
    rect.setAttribute('fill', p.color);
    svgEl.appendChild(rect);

    const label = document.createElementNS(NS, 'text');
    const right = n.col === numCols - 1;
    label.setAttribute('x', right ? p.x + NW + 6 : p.x + NW + 6);
    label.setAttribute('y', p.midY + 3.5);
    label.setAttribute('text-anchor', 'start');
    label.setAttribute('fill', T.sankeyLabel);
    label.setAttribute('font-size', '11');
    label.setAttribute('font-family', "'Work Sans', system-ui, sans-serif");
    label.textContent = n.name;
    svgEl.appendChild(label);
  });
}

/* ═══════════════════════════════════════════════════════════════
   9. SANKEY RENDERS — trade flows then and now
═══════════════════════════════════════════════════════════════ */
let currentTradeMode = null;

function renderSankeyTrade(mode) {
  const all = D().sankeys || {};
  const keys = Object.keys(all);
  if (!keys.length) return;
  currentTradeMode = mode || currentTradeMode || keys[0];
  const data = all[currentTradeMode];
  if (!data) return;
  drawSankey('sankey-trade-svg', data);
  const cap = document.getElementById('sankey-trade-caption');
  if (cap) cap.textContent = data.caption || '';
  renderSourceLine('sankey-trade-source', data.source);
  document.querySelectorAll('#sankey-trade-toggle .sankey-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === currentTradeMode));
}

function buildSankeyToggle() {
  const box = document.getElementById('sankey-trade-toggle');
  if (!box) return;
  const all = D().sankeys || {};
  box.innerHTML = Object.entries(all).map(([k, v], i) =>
    `<button class="sankey-btn${i === 1 ? ' crisis' : ''}" type="button" data-mode="${esc(k)}">${esc(v.label || k)}</button>`).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('.sankey-btn');
    if (b) renderSankeyTrade(b.dataset.mode);
  });
}

/* ═══════════════════════════════════════════════════════════════
   10. CHARTS
═══════════════════════════════════════════════════════════════ */
function hideCard(ctx) { const c = ctx && ctx.closest('.chart-card'); if (c) c.hidden = true; }

/* A vertical line at the scrubber's year on the spread chart. */
const yearLinePlugin = {
  id: 'yearLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts == null || opts.pos == null) return;
    const x = chart.scales.x.getPixelForValue(opts.pos);
    const { top, bottom, left, right } = chart.chartArea;
    if (x < left - 1 || x > right + 1) return;
    const c = chart.ctx;
    c.save();
    c.strokeStyle = opts.color || T.markerActive;
    c.lineWidth = 1.5;
    c.setLineDash([4, 3]);
    c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke();
    c.restore();
  }
};

function compressedTimeScale(overrides = {}) {
  const ticksAt = ((D().meta && D().meta.axisTicks) || []).map(posOfYear);
  const s = mkScale({
    type: 'linear', min: 0, max: POS_MAX,
    title: axisTitle('Year — compressed scale: each segment between ticks is linear'),
    afterBuildTicks: axis => { axis.ticks = ticksAt.map(v => ({ value: v })); },
    ...overrides
  });
  s.ticks = { ...s.ticks, autoSkip: false, maxRotation: 60, callback: v => axisYear(yearOfPos(v)) };
  return s;
}

/* Each mapped centre as a dot on its continent's row, placed on the same
   compressed time axis as the scrubber. The dots are this site's events,
   so the chart shows the order of first evidence, not its density. */
let _spreadMarkerChart = null;
function initSpreadChart() {
  const ctx = document.getElementById('chart-spread');
  if (!ctx) return;
  const evs = D().mapEvents || [];
  const conts = (D().meta && D().meta.continents) || [...new Set(evs.map(e => e.continent))];
  const byEra = ERAS.map(e => ({
    label: e.label,
    data: evs.filter(ev => ev.phase === e.slug && conts.includes(ev.continent))
             .map(ev => ({ x: posOfYear(ev.year), y: conts.indexOf(ev.continent) + (hashJitter(ev.id) - 0.5) * 0.5, ev })),
    backgroundColor: hexA(PC[e.slug], 0.85), borderColor: T.markerStroke, borderWidth: 1,
    pointRadius: 5, pointHoverRadius: 8
  }));
  _spreadMarkerChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: byEra },
    plugins: [yearLinePlugin],
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      plugins: {
        yearLine: { pos: null, color: T.textDim },
        legend: { labels: { color:T.textDim, boxWidth:10, usePointStyle:true, font:{ size:10 } } },
        tooltip: { ...TIP, callbacks: {
          title: items => items[0].raw.ev.title,
          label: c => ` ${c.raw.ev.date} · ${c.raw.ev.place || ''}`,
          footer: items => pointFooter({ source: items[0].raw.ev.source })
        }}
      },
      scales: {
        x: compressedTimeScale(),
        y: mkScale({ min: -0.6, max: conts.length - 0.4, reverse: true,
          afterBuildTicks: axis => { axis.ticks = conts.map((_, i) => ({ value: i })); },
          ticks: { color:T.text, callback: v => conts[v] || '', font:{ size:10 } },
          grid: { color: T.grid } })
      }
    }
  });
}
function hashJitter(s) {
  let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
}

/* A generic cited bar or line chart over one or more series. */
function seriesChart(canvasId, defs, { type = 'bar', yTitle = '', yLog = false, xTitle = 'Year', stacked = false, y1Title = null, sourceEl = null, sourcePrefix = 'Sources: ', yMin = 0, legend = null, yearLine = false } = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const sets = defs.map(d => ({ ...d, rows: series(d.series) })).filter(d => d.rows.length);
  if (!sets.length) { hideCard(ctx); return null; }
  const chart = new Chart(ctx, {
    type,
    plugins: yearLine ? [yearLinePlugin] : [],
    data: {
      datasets: sets.map(d => {
        const col = paint(d.color);
        const derived = r => (r.estimate || [].concat(r.source || []).some(s => s && s.verificationStatus !== 'CONFIRMED'));
        return {
          label: d.label || (seriesMeta(d.series) || {}).label || d.series,
          type: d.type || type,
          data: d.rows.map(r => ({ x: r.year, y: r.value })),
          borderColor: col,
          backgroundColor: (d.type || type) === 'bar'
            ? d.rows.map(r => hexA(col, derived(r) ? 0.38 : 0.8))
            : hexA(col, 0.13),
          fill: (d.type || type) === 'line' && d.fill !== false && sets.length === 1,
          borderWidth: (d.type || type) === 'bar' ? 1 : 2.4,
          borderDash: d.dash || [],
          pointRadius: (d.type || type) === 'line' ? d.rows.map(r => derived(r) ? 3 : 4) : 0,
          pointStyle: d.rows.map(r => derived(r) ? 'rectRot' : 'circle'),
          tension: 0.2, borderRadius: 2, borderSkipped: false,
          yAxisID: d.axis || 'y', parsing: false, spanGaps: true
        };
      })
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: legend ?? sets.length > 1, labels: { color:T.textDim, boxWidth:14, font:{ size:10 } } },
        yearLine: { pos: null, color: T.textDim },
        tooltip: { ...TIP, callbacks: {
          title: items => fmtYear(items[0].raw.x),
          label: c => {
            const d = sets[c.datasetIndex], r = d.rows[c.dataIndex];
            const u = (seriesMeta(d.series) || {}).unit || '';
            return ` ${c.dataset.label}: ${fmtNum(c.raw.y)}${u ? ' ' + u : ''}${r.estimate ? ' (est.)' : ''}`;
          },
          footer: items => pointFooter(sets[items[0].datasetIndex].rows[items[0].dataIndex])
        }}
      },
      scales: {
        x: yearScale({ title: axisTitle(xTitle), offset: type === 'bar', stacked }),
        y: mkScale({ type: yLog ? 'logarithmic' : 'linear', min: yLog ? undefined : yMin, stacked,
          title: axisTitle(yTitle), ticks: { color:T.text, callback: v => fmtNum(v) } }),
        ...(y1Title ? { y1: mkScale({ position:'right', grid:{ drawOnChartArea:false }, min: 0,
          title: axisTitle(y1Title), ticks: { color:T.text, callback: v => fmtNum(v) } }) } : {})
      }
    }
  });
  if (sourceEl) seriesSourceLine(sourceEl, sets.flatMap(d => d.rows), sourcePrefix);
  return chart;
}

/* The chart set is declared in the data layer (D().charts), so a series
   added later appears without touching this file. */
const _yearLineCharts = [];
function initSeriesCharts() {
  _yearLineCharts.length = 0;
  (D().charts || []).forEach(c => {
    const ch = seriesChart(c.canvas, c.datasets, c.options || {});
    if (ch && c.options && c.options.yearLine) _yearLineCharts.push(ch);
  });
}

/* Category bars: one cited value per bar, no time axis. */
function initBarCharts() {
  (D().barCharts || []).forEach(bc => {
    const ctx = document.getElementById(bc.canvas);
    if (!ctx) return;
    const bars = bc.bars || [];
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bars.map(b => b.label),
        datasets: [{
          data: bars.map(b => b.value),
          backgroundColor: bars.map(b => hexA(paint(b.color), 0.8)),
          borderColor: bars.map(b => paint(b.color)),
          borderWidth: 1, borderRadius: 2, borderSkipped: false
        }]
      },
      options: {
        indexAxis: bc.horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...TIP, callbacks: {
            label: c => ` ${fmtNum(c.raw)} ${bc.unit || ''}`,
            footer: items => pointFooter(bars[items[0].dataIndex])
          }}
        },
        scales: {
          [bc.horizontal ? 'x' : 'y']: mkScale({ min: 0, title: axisTitle(bc.unit || ''), ticks: { color:T.text, callback: v => fmtNum(v) } }),
          [bc.horizontal ? 'y' : 'x']: mkScale({ ticks: { color:T.text, font: { size: 10 } }, grid: { display: false } })
        }
      }
    });
    const el = document.getElementById(bc.sourceEl);
    if (el) el.innerHTML = (bc.note ? esc(bc.note) + ' ' : '') + 'Source: ' + sourceHtml(bars[0] && bars[0].source);
  });
}

/* How firm the evidence is, era by era: every source object attached to a
   mapped event, counted by verification status. The chart is about this
   site's citations, and says so. */
function initEvidenceChart() {
  const ctx = document.getElementById('chart-evidence');
  if (!ctx) return;
  const rows = ERAS.map(e => {
    const c = { CONFIRMED: 0, PENDING: 0, DERIVED: 0 };
    (D().mapEvents || []).filter(ev => ev.phase === e.slug)
      .forEach(ev => [].concat(ev.source || []).forEach(s => { c[s.verificationStatus] = (c[s.verificationStatus] || 0) + 1; }));
    return { e, c };
  });
  const ds = [['CONFIRMED', V.v5], ['PENDING', V.v7], ['DERIVED', V.v2]].map(([k, col]) => ({
    label: k[0] + k.slice(1).toLowerCase(), data: rows.map(r => r.c[k]),
    backgroundColor: hexA(col, 0.8), borderColor: col, borderWidth: 1, borderRadius: 2, stack: 's'
  }));
  new Chart(ctx, {
    type: 'bar',
    data: { labels: rows.map(r => r.e.label), datasets: ds },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color:T.textDim, boxWidth:12, font:{ size:10 } } },
        tooltip: { ...TIP, callbacks: { label: c => ` ${c.dataset.label}: ${c.raw} sources` } }
      },
      scales: {
        x: mkScale({ stacked: true, min: 0, title: axisTitle('Source objects on mapped events') }),
        y: mkScale({ stacked: true, ticks: { color:T.text, font:{ size:10 } } })
      }
    }
  });
}

/* Cumulative mapped centres on the compressed axis, for the scrubber. */
let _centresChart = null;
function initSandboxCentresChart() {
  const ctx = document.getElementById('chart-sandbox-centres');
  if (!ctx) return;
  const evs = [...(D().mapEvents || [])].sort((a, b) => a.year - b.year);
  const pts = evs.map((e, i) => ({ x: posOfYear(e.year), y: i + 1, ev: e }));
  _centresChart = new Chart(ctx, {
    type: 'line',
    plugins: [yearLinePlugin],
    data: { datasets: [{
      label: 'Mapped centres (cumulative)', data: pts, stepped: true, parsing: false,
      borderColor: V.v5, backgroundColor: hexA(V.v5, 0.12), fill: true, borderWidth: 2,
      pointRadius: 2.2, pointBackgroundColor: pts.map(p => PC[p.ev.phase]), pointBorderWidth: 0
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        yearLine: { pos: null, color: T.textDim },
        tooltip: { ...TIP, callbacks: {
          title: items => items[0].raw.ev.title,
          label: c => ` ${c.raw.ev.date} · #${c.raw.y}`
        }}
      },
      scales: {
        x: compressedTimeScale({ title: axisTitle('Compressed time') }),
        y: mkScale({ min: 0, title: axisTitle('Cumulative events') })
      }
    }
  });
}

function initEraChart() {
  const ctx = document.getElementById('chart-eras');
  if (!ctx || !ERAS.length) return;
  const now = (D().meta && D().meta.asOfYear) || new Date().getFullYear();
  const spans = ERAS.map((e, i) => {
    const end = i < ERAS.length - 1 ? ERAS[i + 1].start : now;
    return { label: e.label, years: end - Math.max(e.start, YEAR_MIN), e };
  });
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: spans.map(s => s.label),
      datasets: [{
        label: 'Years in era',
        data: spans.map(s => s.years),
        backgroundColor: spans.map(s => hexA(PC[s.e.slug], 0.8)),
        borderColor: spans.map(s => PC[s.e.slug]),
        borderWidth: 1.5, borderRadius: 3, borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: { ...TIP, callbacks: {
          label: c => ` ${c.raw.toLocaleString('en-US')} years`,
          footer: items => wrap(spans[items[0].dataIndex].e.note || '', 60)
        }},
        legend: { display: false }
      },
      scales: {
        x: mkScale({ type:'logarithmic', title: axisTitle('Years (log scale)'),
          ticks: { color:T.text, callback: v => [10, 30, 100, 300, 1000, 3000].includes(v) ? v.toLocaleString('en-US') : '' } }),
        y: mkScale({ ticks: { font: { size: 10 } } })
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   11. TABLES
═══════════════════════════════════════════════════════════════ */
const NET_CLS = {
  'Enriched':'net-gain', 'Profited':'net-gain', 'Revived':'net-gain', 'Transformed':'net-exposure',
  'Coerced':'net-catastrophic', 'Enslaved':'net-catastrophic', 'Revolted':'net-severe',
  'Collapsed':'net-severe', 'Displaced':'net-severe', 'Mixed':'net-mixed', 'Endured':'net-moderate',
  'Polluted':'net-catastrophic', 'Persisted':'net-moderate', 'Dominant':'net-gain'
};

function buildRegionTable() {
  const tbody = document.getElementById('geo-table-body');
  if (!tbody) return;
  tbody.innerHTML = (D().regionImpact || []).map(row => `
    <tr>
      <td class="country-cell" style="white-space:normal;min-width:130px">${esc(row.region)}
        <div class="disp-note">${esc(row.years || '')}</div></td>
      <td><span class="role-badge">${esc(row.role)}</span></td>
      <td style="max-width:440px;font-size:12px;color:var(--text-secondary);line-height:1.55">${esc(row.cost)}
        <div class="table-source">${sourceHtml(row.source)}</div></td>
      <td><span class="net-badge ${NET_CLS[row.net] || 'net-moderate'}">${esc(row.net)}</span></td>
    </tr>`).join('');
}

function buildLabourSection() {
  const section = document.getElementById('labour');
  const rows = D().coercion || [];
  if (!section) return;
  if (!rows.length) { section.hidden = true; return; }
  section.hidden = false;
  const tbody = document.getElementById('labour-table-body');
  if (tbody) {
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="country-cell" style="white-space:normal;max-width:220px">${esc(r.place)}
          <div class="disp-note">${esc(r.years || '')}</div></td>
        <td style="white-space:normal;max-width:200px">${esc(r.system)}</td>
        <td style="white-space:normal;min-width:120px"><strong class="labour-figure">${esc(r.figure || '—')}</strong>
          ${r.figureLabel ? `<div class="disp-note">${esc(r.figureLabel)}</div>` : ''}</td>
        <td style="white-space:normal;max-width:360px;font-size:12px;color:var(--text-secondary)">${esc(r.summary)}</td>
        <td style="font-size:10px;max-width:220px;white-space:normal">${sourceHtml(r.source)}</td>
      </tr>`).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   12. PLANTS, PHOTO ARCHIVE, STAT BLOCKS, SOURCE AUDIT
═══════════════════════════════════════════════════════════════ */
function buildPlantCards() {
  const grid = document.getElementById('plants-grid');
  if (!grid) return;
  grid.innerHTML = (D().plants || []).map(p => {
    const a = p.media ? mediaById(p.media) : null;
    return `
      <article class="plant-card" style="--plant-accent:${esc(paint(p.color, V.v5))}">
        ${a ? `<a class="plant-thumb" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener" title="${esc(a.creditLine)}">
          <img src="${esc(a.thumbUrl)}" alt="${esc(a.alt || a.title)}" loading="lazy" referrerpolicy="no-referrer"
               onerror="this.parentElement.remove()" /></a>` : ''}
        <div class="plant-body">
          <p class="plant-latin">${esc(p.latin)}</p>
          <h3 class="plant-name">${esc(p.name)}</h3>
          <p class="plant-where">${esc(p.regions)}</p>
          <p class="plant-note">${esc(p.note)}</p>
          ${a ? `<p class="plant-credit">${esc(a.creditLine)}</p>` : ''}
          <p class="plant-source">${sourceHtml(p.source)}</p>
        </div>
      </article>`;
  }).join('');
}

/* Four small drawings for the four stages of the vat. Each reads the live
   palette through CSS classes, so it follows the theme toggle. */
const VAT_ICONS = {
  leaf: `<svg viewBox="0 0 120 64" aria-hidden="true"><path class="vat-leaf" d="M14 52 C 12 26, 34 10, 70 8 C 70 34, 48 54, 14 52 Z"/>
          <path class="vat-leaf-vein" d="M18 49 C 32 38, 46 26, 64 12"/><path class="vat-leaf" d="M60 56 C 62 38, 80 26, 106 24 C 104 44, 88 58, 60 56 Z" opacity=".75"/>
          <path class="vat-leaf-vein" d="M64 53 C 76 46, 88 38, 101 28"/></svg>`,
  steep: `<svg viewBox="0 0 120 64" aria-hidden="true"><rect x="24" y="22" width="72" height="36" rx="3" class="vat-liquid-green" opacity=".8"/>
          <path class="vat-vessel" d="M20 10 V 58 H 100 V 10"/><path class="vat-leaf" d="M36 30 C 36 22, 44 18, 54 18 C 54 26, 46 30, 36 30 Z" opacity=".8"/>
          <path class="vat-leaf" d="M62 40 C 62 32, 70 28, 80 28 C 80 36, 72 40, 62 40 Z" opacity=".8"/></svg>`,
  beat: `<svg viewBox="0 0 120 64" aria-hidden="true"><rect x="24" y="30" width="72" height="28" rx="3" class="vat-liquid-blue"/>
          <path class="vat-vessel" d="M20 18 V 58 H 100 V 18"/><circle cx="40" cy="22" r="3" class="vat-liquid-blue"/><circle cx="58" cy="14" r="2.5" class="vat-liquid-blue"/>
          <circle cx="76" cy="20" r="3.5" class="vat-liquid-blue"/><rect x="44" y="44" width="12" height="9" rx="1" class="vat-cloth-3"/><rect x="62" y="44" width="12" height="9" rx="1" class="vat-cloth-3"/></svg>`,
  dip: `<svg viewBox="0 0 120 64" aria-hidden="true"><rect x="16" y="6" width="22" height="52" rx="2" class="vat-cloth-1"/>
          <rect x="49" y="6" width="22" height="52" rx="2" class="vat-cloth-2"/><rect x="82" y="6" width="22" height="52" rx="2" class="vat-cloth-3"/>
          <text x="27" y="63" text-anchor="middle" class="vat-mol">out</text><text x="60" y="63" text-anchor="middle" class="vat-mol">air</text><text x="93" y="63" text-anchor="middle" class="vat-mol">dips</text></svg>`
};

function buildVatSteps() {
  const box = document.getElementById('vat-steps');
  const chem = D().chemistry;
  if (!box || !chem) return;
  const accents = ['var(--era-revival)', '#A8B85A', 'var(--dip-4)', 'var(--dip-6)'];
  box.innerHTML = (chem.steps || []).map((s, i) => `
    <div class="vat-step" style="--vat-accent:${accents[i % accents.length]}">
      <div class="vat-figure">${VAT_ICONS[s.icon] || ''}</div>
      <div class="vat-step-kicker">${esc(s.kicker || `Stage ${i + 1}`)}</div>
      <div class="vat-step-title">${esc(s.title)}</div>
      <div class="vat-step-body">${esc(s.body)}</div>
      ${s.source ? `<div class="vat-step-src">${sourceHtml(s.source)}</div>` : ''}
    </div>`).join('');
  const f = document.getElementById('formula-line');
  if (f && chem.formula) {
    f.innerHTML = `<strong>Indigotin</strong> ${esc(chem.formula)}${chem.molarMass ? ` · ${esc(chem.molarMass)}` : ''}` +
      (chem.note ? ` · ${esc(chem.note)}` : '') + (chem.source ? ` · ${sourceHtml(chem.source)}` : '');
  }
}

function buildMediaGrid() {
  const grid = document.getElementById('photo-archive-grid');
  if (!grid) return;
  const assets = D().mediaAssets || [];
  const filter = document.getElementById('archive-filter');
  const render = era => {
    grid.innerHTML = '';
    assets.filter(a => !era || a.era === era).forEach(a => {
      const eraColor = PC[a.era];
      const card = document.createElement('div');
      card.className = 'photo-card';
      card.innerHTML = `
        <a class="photo-thumb-wrap" href="${esc(a.fullUrl || a.sourceUrl)}" target="_blank" rel="noopener" title="Open full-size image">
          <img class="photo-thumb" src="${esc(a.thumbUrl)}" alt="${esc(a.alt || a.title)}" loading="lazy" referrerpolicy="no-referrer"
               onerror="this.style.display='none'; this.parentElement.classList.add('photo-fallback');" />
        </a>
        <div class="photo-meta">
          <div class="photo-title">${esc(a.title)}</div>
          <div class="photo-year">${esc(a.year)}${eraColor ? `<span class="photo-era" style="background:${eraColor};color:${contrastInk(eraColor)}">${esc(eraLabel(a.era))}</span>` : ''}</div>
          <div class="photo-caption">${esc(a.caption || '')}</div>
          <div class="photo-credit">${esc(a.creditLine || '')}</div>
          <div class="photo-license">${esc(a.license)} ${statusBadge(a.verificationStatus)}</div>
          <div class="photo-links">
            <a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">Source record</a>
            ${a.upstreamUrl ? `<a href="${esc(a.upstreamUrl)}" target="_blank" rel="noopener">${esc(a.upstreamArchive || 'Archive record')}</a>` : ''}
          </div>
        </div>`;
      grid.appendChild(card);
    });
  };
  if (filter) {
    const present = ERAS.filter(e => assets.some(a => a.era === e.slug));
    filter.innerHTML = `<button type="button" class="archive-chip is-on" data-era="">All ${assets.length}</button>` +
      present.map(e => `<button type="button" class="archive-chip" data-era="${esc(e.slug)}" style="--chip:${PC[e.slug]}">${esc(e.label)} · ${assets.filter(a => a.era === e.slug).length}</button>`).join('');
    filter.onclick = ev => {
      const b = ev.target.closest('.archive-chip');
      if (!b) return;
      filter.querySelectorAll('.archive-chip').forEach(x => x.classList.toggle('is-on', x === b));
      render(b.dataset.era);
    };
  }
  render('');
}

function renderStatBlocks() {
  const hero = document.querySelector('.hero-stats');
  const hs = D().heroStats;
  if (hero && Array.isArray(hs) && hs.length) {
    hero.innerHTML = hs.map(s => `
      <div>
        <div class="hero-stat-number" style="color:${esc(paint(s.color))}">${esc(s.value)}</div>
        <div class="hero-stat-label">${esc(s.label)}${s.sublabel ? '<br>' + esc(s.sublabel) : ''}</div>
        ${s.source ? `<div class="hero-stat-source">${sourceHtml(s.source)}</div>` : ''}
      </div>`).join('');
  }
  const foot = document.querySelector('.footer-stats');
  const fs = D().footerStats;
  if (foot && Array.isArray(fs) && fs.length) {
    foot.innerHTML = fs.map(s => `
      <div class="footer-stat" style="border-color:${esc(paint(s.color))}">
        <div class="footer-stat-value" style="color:${esc(paint(s.color))}">${esc(s.value)}</div>
        <div class="footer-stat-delta">${esc(s.sublabel || '')}</div>
        <div class="footer-stat-label">${esc(s.label)}</div>
        ${s.source ? `<div class="footer-stat-source">${sourceHtml(s.source)}</div>` : ''}
      </div>`).join('');
  }
}

function buildSourceRoll() {
  const tbody   = document.getElementById('source-roll-body');
  const summary = document.getElementById('source-audit-summary');
  if (!tbody) return;

  const byInst = new Map();
  const counts = { CONFIRMED:0, PENDING:0, DERIVED:0 };
  let total = 0;

  const add = src => {
    if (!src) return;
    if (Array.isArray(src)) { src.forEach(add); return; }
    if (typeof src !== 'object' || !(src.institution || src.url)) return;
    total++;
    const st = src.verificationStatus || 'PENDING';
    counts[st] = (counts[st] || 0) + 1;
    const k = src.institution || 'Unknown';
    const e = byInst.get(k) || { n:0, CONFIRMED:0, PENDING:0, DERIVED:0, url:'', access:new Set() };
    e.n++; e[st] = (e[st] || 0) + 1;
    if (src.accessType) e.access.add(src.accessType);
    if (!e.url && src.url) e.url = src.url;
    byInst.set(k, e);
  };
  const walk = (o, depth) => {
    if (!o || depth > 6) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    if (typeof o !== 'object') return;
    if ('source' in o && typeof o.source === 'object') add(o.source);
    for (const [k, v] of Object.entries(o)) if (k !== 'source' && v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(D(), 0);

  const rows = [...byInst.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  tbody.innerHTML = rows.map(([inst, e]) => `
    <tr>
      <td class="country-cell" style="white-space:normal">${esc(inst)}</td>
      <td>${e.n}</td>
      <td>${e.CONFIRMED ? `<span class="net-badge net-gain">${e.CONFIRMED}</span>` : '—'}</td>
      <td>${e.PENDING ? `<span class="net-badge net-mixed">${e.PENDING}</span>` : '—'}</td>
      <td>${e.DERIVED ? `<span class="net-badge net-moderate">${e.DERIVED}</span>` : '—'}</td>
      <td><span class="role-badge">${[...e.access].join(' / ') || '—'}</span></td>
      <td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener" style="font-family:var(--font-sans);font-size:10px">open ↗</a>` : '—'}</td>
    </tr>`).join('');

  if (summary) {
    const pct = total ? Math.round(100 * counts.CONFIRMED / total) : 0;
    summary.innerHTML =
      `${total.toLocaleString('en-US')} cited data points across ${rows.length} institutions — ` +
      `<strong style="color:var(--v5)">${counts.CONFIRMED} confirmed (${pct}%)</strong>, ` +
      `<strong style="color:var(--v7)">${counts.PENDING} pending</strong>, ` +
      `<strong style="color:var(--v9)">${counts.DERIVED} derived</strong>.`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   13. THEME (light / dark)
═══════════════════════════════════════════════════════════════ */
const THEME_KEY = 'oma-theme';
const SUN_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function buildCharts() {
  initSpreadChart();
  initSeriesCharts();
  initBarCharts();
  initEraChart();
  initEvidenceChart();
  initSandboxCentresChart();
}

function rebuildCharts() {
  document.querySelectorAll('canvas').forEach(c => { const ch = Chart.getChart(c); if (ch) ch.destroy(); });
  _spreadMarkerChart = null;
  _centresChart = null;
  buildCharts();
  const slider = document.getElementById('era-slider');
  if (slider) updateSlider(+slider.value);
}

function updateThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const light = currentTheme() === 'light';
  btn.setAttribute('aria-pressed', String(light));
  btn.title = light ? 'Switch to dark mode' : 'Switch to light mode';
  btn.innerHTML = light ? MOON_SVG : SUN_SVG;
}

function applyTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
  refreshTheme();
  if (scrollMap)  addBasemap(scrollMap);
  if (sandboxMap) addBasemap(sandboxMap);
  restyleMarkers();
  buildPhaseLegend();
  paintSliderTrack();
  const cur = document.querySelector('.scroll-step.is-active');
  if (cur) highlightPhasePill(cur.dataset.phase);
  rebuildCharts();
  renderSankeyTrade();
  buildMediaGrid();
  updateThemeToggle();
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light'));
  updateThemeToggle();
}

let _rsTimer;
window.addEventListener('resize', () => {
  clearTimeout(_rsTimer);
  _rsTimer = setTimeout(() => {
    renderSankeyTrade();
    if (scrollMap)  scrollMap.invalidateSize();
    if (sandboxMap) sandboxMap.invalidateSize();
  }, 220);
}, { passive:true });

/* ═══════════════════════════════════════════════════════════════
   MAIN INIT
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  refreshTheme();
  initThemeToggle();
  initProgressBar();
  initAnchorScroll();
  initNavDrawer();
  initSectionNav();
  buildPhaseLegend();
  setLayoutVars();

  initScrollMap();
  initSandboxMap();

  buildScrollSteps();
  requestAnimationFrame(() => requestAnimationFrame(initScrollytelling));

  buildCharts();
  initSlider();

  buildSankeyToggle();
  setTimeout(() => renderSankeyTrade(), 100);

  buildPlantCards();
  buildVatSteps();
  buildRegionTable();
  buildLabourSection();
  buildMediaGrid();
  renderStatBlocks();
  buildSourceRoll();
});
