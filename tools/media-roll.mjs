#!/usr/bin/env node
/**
 * media-roll.mjs — print the embedded-media roll (Markdown table) from
 * js/data.js `mediaAssets`, for CONTENT_LICENSE.md.
 *
 *   node tools/media-roll.mjs
 */
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const win = {};
new Function('window', src)(win);
const assets = win.indigoData.mediaAssets || [];
const cell = s => String(s ?? '').replace(/\|/g, '\\|');
console.log('| # | Title | Year | Era | License | Credit | Record |');
console.log('|---|---|---|---|---|---|---|');
assets.forEach((a, i) => {
  const rec = a.upstreamUrl && a.upstreamUrl !== a.sourceUrl
    ? `[${cell(a.upstreamArchive || 'archive')}](${a.upstreamUrl}) · [record](${a.sourceUrl})`
    : `[record](${a.sourceUrl})`;
  console.log(`| ${i + 1} | ${cell(a.title)} | ${cell(a.year)} | ${a.era || ''} | ${cell(a.license)} | ${cell(a.creditLine)} | ${rec} |`);
});
console.error(`${assets.length} assets`);
