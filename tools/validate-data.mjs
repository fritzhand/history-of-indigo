#!/usr/bin/env node
/**
 * validate-data.mjs — schema and sanity checks for the indigo data layer.
 *
 *   node tools/validate-data.mjs
 *
 * Checks every `source` object for the citation fields the site requires,
 * era slugs against meta.eras, map-event years against their eras, scroll
 * steps and chart declarations against what they reference, media against
 * the embed-allowed license set, and the hero rule (hero numbers must be
 * CONFIRMED). Also checks the renderer contract: js/app.js prints several
 * fields unguarded, so a missing one would put "undefined" on the page.
 *
 * A domain fork of the Downtown Tampa validator; the study area here is the
 * world, so coordinates are checked for range, not against a bounding box.
 */
import fs from 'node:fs';

const rel = process.argv[2] || 'js/data.js';
const src = fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const win = {};
new Function('window', src)(win);
const d = win.indigoData;
if (!d) { console.log(`ERROR ${rel}: does not define window.indigoData`); process.exit(1); }

const errors = [], warnings = [];
const STATUS = new Set(['CONFIRMED', 'PENDING', 'DERIVED']);
const ACCESS = new Set(['FREE', 'REGISTRATION', 'PAYWALL', 'API']);
const LICENSES = /^(Public domain|PD|CC0|CC BY( \d\.\d)?|CC BY-SA( \d\.\d)?)/i;
const eras = (d.meta && d.meta.eras) || [];
const ERA = new Set(eras.map(e => e.slug));
if (!eras.length) errors.push('meta.eras is empty');
eras.forEach((e, i) => {
  if (i && e.start <= eras[i - 1].start) errors.push(`meta.eras[${i}] (${e.slug}) starts before the era it follows`);
});
const eraOf = y => { let cur = eras[0] && eras[0].slug; for (const e of eras) if (y >= e.start) cur = e.slug; return cur; };

const statusCounts = { CONFIRMED: 0, PENDING: 0, DERIVED: 0 };
const institutions = new Set();
function checkSource(s, where) {
  if (!s) { errors.push(`${where}: missing source`); return; }
  if (typeof s === 'string') { errors.push(`${where}: source is a free-text string, not a source object`); return; }
  if (Array.isArray(s)) { if (!s.length) errors.push(`${where}: empty source array`); s.forEach((x, i) => checkSource(x, `${where}[${i}]`)); return; }
  for (const k of ['institution', 'date', 'url']) if (!s[k]) errors.push(`${where}: source.${k} missing`);
  if (s.url && !/^https?:\/\//.test(s.url)) errors.push(`${where}: source.url is not http(s)`);
  if (!STATUS.has(s.verificationStatus)) errors.push(`${where}: verificationStatus "${s.verificationStatus}" invalid`);
  else statusCounts[s.verificationStatus]++;
  if (!ACCESS.has(s.accessType)) errors.push(`${where}: accessType "${s.accessType}" invalid`);
  if (s.verificationStatus === 'DERIVED' && !s.note) warnings.push(`${where}: DERIVED without a methodology note`);
  if (s.institution) institutions.add(s.institution);
}

/* Walk every source object anywhere in the tree. */
function walk(o, where, depth) {
  if (!o || typeof o !== 'object' || depth > 7) return;
  if (Array.isArray(o)) { o.forEach((x, i) => walk(x, `${where}[${i}]`, depth + 1)); return; }
  if ('source' in o && (typeof o.source === 'object' || typeof o.source === 'string')) checkSource(o.source, where);
  for (const [k, v] of Object.entries(o)) if (k !== 'source' && v && typeof v === 'object') walk(v, `${where}.${k}`, depth + 1);
}
walk(d, 'data', 0);

/* mapEvents */
const ids = new Set();
(d.mapEvents || []).forEach((ev, i) => {
  const w = `mapEvents[${i}] (${ev.id})`;
  if (!ev.id) errors.push(`${w}: missing id`); else if (ids.has(ev.id)) errors.push(`${w}: duplicate id`); else ids.add(ev.id);
  if (!ERA.has(ev.phase)) errors.push(`${w}: phase "${ev.phase}" unknown`);
  if (typeof ev.year !== 'number') errors.push(`${w}: numeric year missing`);
  else if (ERA.has(ev.phase) && eraOf(ev.year) !== ev.phase) errors.push(`${w}: year ${ev.year} falls in era "${eraOf(ev.year)}", not "${ev.phase}"`);
  if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') errors.push(`${w}: lat/lng missing`);
  else if (Math.abs(ev.lat) > 85 || Math.abs(ev.lng) > 180) errors.push(`${w}: coordinates out of range`);
  if (!ev.continent) warnings.push(`${w}: no continent (it will not appear on the spread chart)`);
  else if (d.meta.continents && !d.meta.continents.includes(ev.continent)) errors.push(`${w}: continent "${ev.continent}" not in meta.continents`);
  if (!('source' in ev)) errors.push(`${w}: missing source`);
});

/* Renderer contract. */
const REQUIRED = {
  scrollSteps: ['eventId', 'date', 'phase', 'headline', 'narrative'],
  mapEvents:   ['id', 'date', 'phase', 'title', 'body', 'place'],
  heroStats:   ['value', 'label'],
  footerStats: ['value', 'label'],
  mediaAssets: ['id', 'title', 'year', 'thumbUrl', 'sourceUrl', 'license', 'creditLine', 'era'],
  plants:      ['latin', 'name', 'regions', 'note'],
  regionImpact:['region', 'role', 'cost', 'net'],
  coercion:    ['place', 'system', 'summary'],
};
for (const [key, fields] of Object.entries(REQUIRED)) {
  (d[key] || []).forEach((row, i) => {
    for (const f of fields) {
      if (row[f] === undefined || row[f] === null || row[f] === '') {
        errors.push(`${key}[${i}]${row.id ? ` (${row.id})` : ''}: missing "${f}" — app.js renders this field`);
      }
    }
  });
}

/* Steps reference events and media by id. */
const mediaIds = new Set();
(d.mediaAssets || []).forEach((a, i) => {
  const w = `mediaAssets[${i}] (${a.id})`;
  if (mediaIds.has(a.id)) errors.push(`${w}: duplicate id`);
  mediaIds.add(a.id);
  if (a.license && !LICENSES.test(a.license)) errors.push(`${w}: license "${a.license}" is not in the embed-allowed set`);
  if (a.era && !ERA.has(a.era)) errors.push(`${w}: era "${a.era}" unknown`);
  if (a.thumbUrl && !/^(https:\/\/|assets\/)/.test(a.thumbUrl)) errors.push(`${w}: thumbUrl must be https or a local assets/ path`);
  if (a.thumbUrl && a.thumbUrl.startsWith('assets/') && !fs.existsSync(new URL('../' + a.thumbUrl, import.meta.url))) errors.push(`${w}: local thumb ${a.thumbUrl} does not exist`);
  if (!a.rightsEvidence) warnings.push(`${w}: no rightsEvidence recorded`);
});
(d.scrollSteps || []).forEach((st, i) => {
  if (!ids.has(st.eventId)) errors.push(`scrollSteps[${i}]: eventId "${st.eventId}" matches no mapEvent`);
  if (!ERA.has(st.phase)) errors.push(`scrollSteps[${i}]: phase "${st.phase}" unknown`);
  const ev = (d.mapEvents || []).find(e => e.id === st.eventId);
  if (ev && ev.phase !== st.phase) errors.push(`scrollSteps[${i}]: phase "${st.phase}" differs from its event's "${ev.phase}"`);
  (st.media || []).forEach(m => { if (!mediaIds.has(m)) errors.push(`scrollSteps[${i}]: media id "${m}" matches no mediaAsset`); });
  (st.chips || []).forEach((c, j) => { if (!c.label || c.value == null) errors.push(`scrollSteps[${i}].chips[${j}]: label and value required`); });
});
for (let i = 1; i < (d.scrollSteps || []).length; i++) {
  const a = (d.mapEvents || []).find(e => e.id === d.scrollSteps[i - 1].eventId);
  const b = (d.mapEvents || []).find(e => e.id === d.scrollSteps[i].eventId);
  if (a && b && b.year < a.year) warnings.push(`scrollSteps[${i}]: ${b.id} (${b.year}) comes after ${a.id} (${a.year}) — out of order`);
}
(d.plants || []).forEach((p, i) => { if (p.media && !mediaIds.has(p.media)) errors.push(`plants[${i}]: media "${p.media}" matches no mediaAsset`); });

/* Series and the charts that draw them. */
const series = d.series || {};
for (const [id, s] of Object.entries(series)) {
  if (!s.label || !s.unit) errors.push(`series.${id}: label and unit required`);
  const pts = s.points || [];
  if (!pts.length) errors.push(`series.${id}: no points`);
  pts.forEach((p, i) => {
    if (typeof p.year !== 'number' || typeof p.value !== 'number') errors.push(`series.${id}.points[${i}]: numeric year and value required`);
    if (i && p.year <= pts[i - 1].year) errors.push(`series.${id}.points[${i}]: years not strictly increasing`);
  });
}
(d.charts || []).forEach((c, i) => {
  (c.datasets || []).forEach(ds => { if (!series[ds.series]) errors.push(`charts[${i}] (${c.canvas}): series "${ds.series}" does not exist`); });
});
((d.meta && d.meta.sliderCards) || []).forEach(c => { if (!series[c.series]) errors.push(`meta.sliderCards (${c.id}): series "${c.series}" does not exist`); });

/* Sankeys: links point at nodes. */
for (const [k, s] of Object.entries(d.sankeys || {})) {
  (s.links || []).forEach((l, i) => {
    if (!s.nodes[l.source] || !s.nodes[l.target]) errors.push(`sankeys.${k}.links[${i}]: dangling node index`);
  });
}

/* Hero rule. */
(d.heroStats || []).forEach((s, i) => {
  const all = [].concat(s.source || []);
  if (!all.length || all.some(x => x.verificationStatus !== 'CONFIRMED')) errors.push(`heroStats[${i}] (${s.label}): hero numbers must be CONFIRMED`);
});

console.log(`sections: ${Object.keys(d).length} · sources by status: ${JSON.stringify(statusCounts)} · institutions: ${institutions.size}`);
console.log(`mapEvents: ${(d.mapEvents || []).length} · scrollSteps: ${(d.scrollSteps || []).length} · series: ${Object.keys(series).length} · mediaAssets: ${(d.mediaAssets || []).length}`);
console.log(`eras: ${[...ERA].join(', ')}`);
warnings.forEach(w => console.log('WARN  ' + w));
errors.forEach(e => console.log('ERROR ' + e));
console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
