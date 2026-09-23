#!/usr/bin/env node
/* ================================================================
   build-cards.mjs: the Instagram launch set for
   "Indigo: The Blue That Dyed the World".

     node collateral/instagram-2026-09/build-cards.mjs              # all four cards, then check
     node collateral/instagram-2026-09/build-cards.mjs 03-numbers   # one card
     node collateral/instagram-2026-09/build-cards.mjs check        # re-read the PNGs on disk
     node collateral/instagram-2026-09/build-cards.mjs proof        # feed + grid proof (gitignored)

   Needs playwright and sharp available to node, like tools/render-card.mjs.
   Behind a proxy, prefix NODE_USE_ENV_PROXY=1 (as for tools/check-links.mjs):
   every remote request the pages make, Google Fonts and the site's CDN
   scripts, is fulfilled through node's fetch so the proxy applies.

   Four 1080x1350 cards, posted in this order as one carousel:

     01-site      the landing page on a phone, header to just below the
                  byline icons, on the deepest dip of the ramp
     02-plants    Many plants, one blue: two public-domain botanical plates
     03-numbers   the four hero figures, each in its era colour
     04-checked   four famous stories the sources do not support, and
                  what the project is made of

   Nothing on a card is typed twice. The figures come from js/data.js at
   build time and each card asserts the record it quotes still says what
   the card says, so a change to the data fails the build instead of
   quietly contradicting the site. The phone screen is a fresh capture of
   index.html, so the mockup is always the page as it stands.

   Every card is checked in the browser before it is written: no glyph
   may fall back to a system font, every line of text must clear WCAG AA
   on the colour behind it, nothing may overflow its box or overlap the
   next block, and all type sits inside the crop-safe frame (see SAFE_X).
   ================================================================ */

import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const W = 1080, H = 1350;   // Instagram's portrait post, 4:5
const SCALE = 2;            // render at 2x, downsample with lanczos3
/* THE CROP. The feed shows a 4:5 post whole, but the profile grid shows it
   as a 3:4 tile: 1350 x 0.75 = 1012.5 px of the width, centred, so 34 px
   go from each side. 64 keeps every letter 30 px clear of that edge. */
const SAFE_X = 64;
const SAFE_Y = 40;
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

/* ─── The data layer, read rather than retyped ─── */
const DATA = (() => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8'), sandbox, { filename: 'js/data.js' });
  return sandbox.window.indigoData || die('js/data.js did not define window.indigoData');
})();

const list = (s) => (Array.isArray(s) ? s : s ? [s] : []);
const find = (arr, id, what) => arr.find((x) => x.id === id) || die(`no ${what} "${id}" in js/data.js`);
const event = (id) => find(DATA.mapEvents, id, 'event');
const asset = (id) => find(DATA.mediaAssets, id, 'media asset');
const plant = (id) => find(DATA.plants, id, 'plant');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Assert that a record still carries the words a card sets from it. */
const says = (what, text, ...needles) => {
  for (const n of needles) if (!String(text).includes(n)) die(`${what} no longer says "${n}". Update the card copy to match js/data.js.`);
};
const confirmed = (what, src) => {
  const s = list(src);
  if (!s.length || s.some((x) => x.verificationStatus !== 'CONFIRMED')) die(`${what}: a card figure must rest on CONFIRMED sources only`);
  return s;
};

/* The source audit, counted exactly as buildSourceRoll() in js/app.js counts
   it, so the card and the page's own tally cannot disagree. */
const TALLY = (() => {
  const inst = new Set();
  let total = 0;
  const add = (src) => {
    if (!src) return;
    if (Array.isArray(src)) { src.forEach(add); return; }
    if (typeof src !== 'object' || !(src.institution || src.url)) return;
    total++;
    inst.add(src.institution || 'Unknown');
  };
  const walk = (o, depth) => {
    if (!o || depth > 6) return;
    if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
    if (typeof o !== 'object') return;
    if ('source' in o && typeof o.source === 'object') add(o.source);
    for (const [k, v] of Object.entries(o)) if (k !== 'source' && v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(DATA, 0);
  return { total, institutions: inst.size, images: DATA.mediaAssets.length };
})();
const fmt = (n) => n.toLocaleString('en-US');

/* ─── Palette: every value is a token from css/styles.css (light theme)
   or tools/og-card.html. Nothing here is new to the project. ─── */
const C = {
  paper: '#F8F7F3',     // --bg-base, unbleached cotton
  ink: '#161A26',       // --text-primary
  soft: '#464A57',      // --text-soft, running text
  muted: '#636878',     // --text-secondary, labels and credits
  border: '#E2E0D8',    // --border
  heavy: '#1A1A1A',     // the share card's masthead rule
  indigo: '#2E3F9E',    // --v5, the one accent
  madder: '#A61B1B',    // --v9, kept for the verdicts on card 04
  dips: ['#D9E2F5', '#A9BCE8', '#7390D6', '#4760B0', '#2C3F86', '#18234F'],
  era: {
    origins: '#8C6A33', medieval: '#7F6F12', searoutes: '#2C7680', plantation: '#6A4A9E',
    empire: '#A61B1B', synthetic: '#5E6575', denim: '#2E4FA8', revival: '#3C7A47',
  },
  vatNav: '#0E1016',    // the page's theme-color: what the phone's status bar takes
};

/* ─── Shared furniture ─── */
const FONTS = 'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=block';

const img = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const media = (id) => img(path.join(ROOT, 'assets', 'media', `${id}.jpg`), 'image/jpeg');

/* The site mark: a cloth dipped five times and the leaf the blue came from.
   Same drawing as the nav and tools/og-card.html. */
const MARK = `<svg class="mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="11" y="4" width="17" height="4.8" rx=".8" fill="#D9E2F5"/>
  <rect x="11" y="9.2" width="17" height="4.8" rx=".8" fill="#A9BCE8"/>
  <rect x="11" y="14.4" width="17" height="4.8" rx=".8" fill="#7390D6"/>
  <rect x="11" y="19.6" width="17" height="4.8" rx=".8" fill="#4760B0"/>
  <rect x="11" y="24.8" width="17" height="3.4" rx=".8" fill="#2C3F86"/>
  <path d="M3.2 25.5 C 2.6 17, 6.6 11.2, 13.4 9.2 C 13.6 16.8, 9.8 23.4, 3.2 25.5 Z" fill="#3C7A47"/>
  <path d="M3.8 24.6 C 6.6 19.6, 9.2 15.4, 12.6 10.4" stroke="#F8F7F3" stroke-width=".8" fill="none" stroke-linecap="round"/>
</svg>`;

/* The dip strip: the page's thesis in one picture, as under the hero and on
   the share card. It is the one motif every card repeats. */
const DIPS = `<div class="dips" aria-hidden="true">${C.dips.map((c) => `<span style="background:${c}"></span>`).join('')}</div>`;

const URL_TEXT = 'fritzhand.github.io/history-of-indigo';

const masthead = (section) => `
<header class="mast" data-block>
  <div class="imprint">${MARK}
    <div><div class="imprint-name">Open Material Archive</div>
    <div class="imprint-sub">Indigo &middot; c. 4000 BCE &ndash; today</div></div>
  </div>
  <div class="mast-r">${section}</div>
</header>
<div class="rules"><div class="rule-heavy"></div><div class="rule-hair"></div></div>`;

const foot = (right = 'By <b>Jeremy Fritzhand</b>') => `
<footer class="foot" data-block>
  <div class="foot-rule"></div>
  <div class="foot-row"><span class="url">${URL_TEXT}</span><span class="by">${right}</span></div>
</footer>`;

const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:'Work Sans',sans-serif;-webkit-font-smoothing:antialiased;background:${C.paper};color:${C.ink}}
.card{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${C.paper}}
.page{position:absolute;left:84px;right:84px;top:58px;bottom:52px;display:flex;flex-direction:column}
.page > *{flex:none}

.mast{display:flex;align-items:center;justify-content:space-between;gap:24px}
.imprint{display:flex;align-items:center;gap:14px}
.mark{width:46px;height:46px;display:block;flex:none}
.imprint-name{font:600 17px/1 'Work Sans';letter-spacing:.2em;text-transform:uppercase;color:${C.ink}}
.imprint-sub{margin-top:8px;font:500 13px/1 'Work Sans';letter-spacing:.18em;text-transform:uppercase;color:${C.muted}}
.mast-r{font:600 14px/1 'Work Sans';letter-spacing:.2em;text-transform:uppercase;color:${C.muted};text-align:right}
.rules{margin-top:18px}
.rule-heavy{height:2px;background:${C.heavy}}
.rule-hair{height:1px;background:${C.border};margin-top:4px}

.kicker{font:600 16px/1 'Work Sans';letter-spacing:.22em;text-transform:uppercase;color:${C.indigo}}
.title{font-family:'Crimson Pro',Georgia,serif;font-weight:600;letter-spacing:-.022em;color:${C.ink}}
.title em{font-style:italic;color:${C.dips[4]}}
.dips{display:flex;gap:3px}
.dips span{width:46px;height:12px;display:block}
.stand{font:400 26px/1.5 'Work Sans';color:${C.soft}}

.foot{margin-top:auto}
.foot-rule{height:1px;background:${C.border}}
.foot-row{margin-top:18px;display:flex;justify-content:space-between;align-items:baseline;gap:24px}
.url{font:600 20px/1 'Work Sans';color:${C.indigo}}
.by{font:500 14px/1 'Work Sans';letter-spacing:.16em;text-transform:uppercase;color:${C.muted}}
.by b{color:${C.ink};font-weight:700}
`;

/* ================================================================
   01-site: the cover.

   The ground is the deepest dip, #18234F: the card is the colour the page is
   about, and a deep blue stands out in a feed. The phone shows the page in
   its default dark theme, the way a visitor first meets it.

   The device is drawn whole, status bar to home indicator, because the crop
   the brief asks for (the header to just below the icons under the byline) is
   almost exactly what a phone browser shows: 712 css px of page between a
   50 px status bar and an 84 px toolbar makes a 390 x 846 screen, the shape of
   a 6.1-inch phone. The address bar carries the domain, so the mockup names
   the site on its own; the full path sits under the phone.
   ================================================================ */
const GROUND = C.dips[5];
const PHONE = { screenW: 390, status: 50, toolbar: 84, bezel: 12, band: 3.5, radius: 54 };

const STATUS_ICONS = `<span class="st-icons" aria-hidden="true">
  <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx=".8" fill="#fff"/><rect x="5.2" y="5.5" width="3.2" height="6.5" rx=".8" fill="#fff"/><rect x="10.4" y="3" width="3.2" height="9" rx=".8" fill="#fff"/><rect x="15.6" y="0" width="3.2" height="12" rx=".8" fill="#fff"/></svg>
  <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 11.6 6.1 9.2a3.4 3.4 0 0 1 4.8 0z" fill="#fff"/><path d="M3.7 6.8a6.8 6.8 0 0 1 9.6 0l-1.4 1.4a4.8 4.8 0 0 0-6.8 0z" fill="#fff"/><path d="M1.2 4.3a10.4 10.4 0 0 1 14.6 0l-1.4 1.4a8.4 8.4 0 0 0-11.8 0z" fill="#fff"/></svg>
  <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2.3" y="2.3" width="19.4" height="8.4" rx="2.2" fill="#fff"/><path d="M25 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1z" fill="#fff" fill-opacity=".5"/></svg>
</span>`;
const LOCK = `<svg viewBox="0 0 11 13" aria-hidden="true"><rect x=".5" y="5.5" width="10" height="7" rx="1.6" fill="#ECEEF5"/><path d="M2.7 5.6V3.9a2.8 2.8 0 0 1 5.6 0v1.7" fill="none" stroke="#ECEEF5" stroke-width="1.3"/></svg>`;

const phone = (screen, zoom) => {
  const P = PHONE;
  return `<div class="phone" style="zoom:${zoom}" data-block>
  <div class="phone-body">
    <i class="key l" style="top:150px;height:30px"></i><i class="key l" style="top:206px;height:58px"></i><i class="key l" style="top:276px;height:58px"></i><i class="key r" style="top:226px;height:88px"></i>
    <div class="bezel"><div class="screen">
      <div class="status"><span class="time">9:41</span>${STATUS_ICONS}</div>
      <div class="island"></div>
      <img class="shot" src="${screen.uri}" width="${P.screenW}" height="${screen.cut}" alt="">
      <div class="toolbar"><div class="addr">${LOCK}<span>fritzhand.github.io</span></div><div class="home"></div></div>
    </div></div>
  </div>
</div>`;
};

const cover = (screen) => {
  const P = PHONE;
  says('index.html <title>', INDEX.match(/<title>([^<]*)<\/title>/)?.[1], 'Indigo: The Blue That Dyed the World');
  const phoneH = P.status + screen.cut + P.toolbar + 2 * (P.bezel + P.band);
  const PHONE_PX = 972;                   // the phone's height on the card
  const zoom = +(PHONE_PX / phoneH).toFixed(4);
  return {
    id: '01-site', file: '01-site-4x5-1080x1350.png',
    alt: `The landing page of Indigo: The Blue That Dyed the World on a phone, from the site header to the byline, Jeremy Fritzhand, and its GitHub and LinkedIn icons. Above the phone, the title Indigo; below it, the address ${URL_TEXT}.`,
    css: `
.card{background:${GROUND}}
.top{position:absolute;left:84px;right:84px;top:58px;text-align:center}
.cover-kicker{font:600 15px/1 'Work Sans';letter-spacing:.22em;text-transform:uppercase;color:${C.dips[1]}}
.cover-title{margin-top:16px;font:600 118px/.9 'Crimson Pro',Georgia,serif;letter-spacing:-.024em;color:${C.paper}}
.cover-deck{margin-top:6px;font:italic 600 44px/1.05 'Crimson Pro',Georgia,serif;color:${C.dips[0]}}
.stage{position:absolute;left:0;right:0;top:274px;display:flex;justify-content:center}
.cover-url{position:absolute;left:84px;right:84px;bottom:50px;text-align:center;font:600 21px/1 'Work Sans';letter-spacing:.02em;color:${C.dips[0]}}

.phone{position:relative;flex:none}
/* The one shadow in the set: the device is the one object that stands off
   the page, and the shadow is what says so. */
.phone-body{position:relative;padding:${P.band}px;border-radius:${P.radius + P.bezel + P.band}px;
  background:linear-gradient(150deg,#7a7e87 0%,#3a3d45 18%,#202228 50%,#3a3d45 82%,#8a8e97 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 50px 80px -30px rgba(0,0,0,.55)}
.bezel{padding:${P.bezel}px;border-radius:${P.radius + P.bezel}px;background:#040507}
.screen{position:relative;width:${P.screenW}px;border-radius:${P.radius}px;overflow:hidden;background:#0A0C12}
.status{height:${P.status}px;background:${C.vatNav};display:flex;align-items:center;justify-content:space-between;padding:4px 33px 0 50px;color:#fff}
.time{font:600 17px/1 'Work Sans';letter-spacing:-.01em}
.st-icons{display:flex;gap:6px;align-items:center}
.island{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:122px;height:35px;border-radius:18px;background:#000}
.shot{display:block}
.toolbar{position:relative;height:${P.toolbar}px;background:#15171E;border-top:1px solid rgba(255,255,255,.07)}
.addr{position:absolute;left:18px;right:18px;top:11px;height:44px;border-radius:22px;background:#252935;
  display:flex;align-items:center;justify-content:center;gap:7px;color:#ECEEF5;font:500 16px/1 'Work Sans'}
.addr svg{width:11px;height:13px;flex:none}
.home{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#ECEEF5}
.key{position:absolute;width:4px;border-radius:2px}
.key.l{left:-2.5px;background:linear-gradient(90deg,#2a2c32,#6a6e77)}
.key.r{right:-2.5px;background:linear-gradient(90deg,#6a6e77,#2a2c32)}`,
    body: `
<div class="top" data-block>
  <div class="cover-kicker">A data-journalism history &nbsp;&middot;&nbsp; ${fmt(TALLY.total)} cited data points</div>
  <h1 class="cover-title">Indigo</h1>
  <div class="cover-deck">The Blue That Dyed the World</div>
</div>
<div class="stage">${phone(screen, zoom)}</div>
<div class="cover-url" data-block>${URL_TEXT}</div>`,
  };
};

/* ================================================================
   02-plants: Many plants, one blue.

   The plates are the archive's two public-domain botanical engravings of a
   whole plant: Ehret's Indigofera and Bouchard's woad, a legume and a
   cabbage relative, two of the four families the page names. (The other dye
   plants are CC BY-SA photographs, and a card that crops one takes on its
   share-alike terms.) Each is shown whole, inscription and border included, at its own
   proportions: cropping an engraving to fit a box cuts its lettering, and
   the plate is the evidence. They hang from the top of two grid columns,
   keylined, with caption and credit set beneath. Type never sits on an
   image.
   ================================================================ */
const PLATE_H = 556;
const plants = async () => {
  const ind = plant('indigofera-tinctoria'), woad = plant('isatis-tinctoria');
  const ehret = asset('ehret-indigofera-tinctoria'), bouchard = asset('woad-isatis-bouchard-1770s');
  for (const a of [ehret, bouchard]) if (a.license !== 'Public domain') die(`${a.id} is no longer public domain`);
  says('the molecule section of index.html', INDEX, 'made by plants in at least four unrelated families',
    'legumes in South Asia', 'Cultures that never met found their own plant and arrived at the same chemistry');
  says('the Indigofera plant', `${ind.latin} ${ind.note}`, 'Indigofera tinctoria', 'The source of "Indian" indigo', 'Pliny', 'Bengal');
  says('the woad plant', `${woad.latin} ${woad.note}`, 'Isatis tinctoria', 'A cabbage relative', 'Europe\'s blue', 'seventeenth century');
  says('Ehret\'s plate', `${ehret.creator} ${ehret.year} ${ehret.creditLine}`, 'Haid', 'Ehret', 'c. 1750–53', 'Wellcome Collection');
  says('Bouchard\'s plate', `${bouchard.creator} ${bouchard.year} ${bouchard.creditLine}`, 'Magdalena Bouchard', '1770s', 'Wellcome Collection');
  const chem = DATA.chemistry;
  confirmed('the formula', chem.source);
  says('the formula', chem.formula, 'C₁₆H₁₀N₂O₂');

  const plate = async (a) => {
    const f = path.join(ROOT, 'assets', 'media', `${a.id}.jpg`);
    const { width, height } = await sharp(f).metadata();
    return `<div class="plate" style="width:${Math.round(PLATE_H * width / height)}px;height:${PLATE_H}px"><img src="${media(a.id)}" alt=""></div>`;
  };
  return {
    id: '02-plants', file: '02-plants-4x5-1080x1350.png',
    alt: 'Two eighteenth-century botanical engravings side by side: true indigo, Indigofera tinctoria, drawn by Georg Dionysius Ehret, and woad, Isatis tinctoria, etched by Magdalena Bouchard. Headline: Many plants, one blue.',
    css: `
.kicker{margin-top:44px}
.title{margin-top:14px;font-size:92px;line-height:.95}
.dips{margin-top:22px}
.stand{margin-top:22px;max-width:900px}
.plates{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;column-gap:28px}
.fig{min-width:0}
.plate{position:relative;overflow:hidden;background:#EDEAE3}
.plate img{width:100%;height:100%;display:block}
.plate::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(22,26,38,.14)}
.cap-name{margin-top:16px;font:600 28px/1.1 'Crimson Pro',Georgia,serif;color:${C.ink}}
.cap-name i{font-weight:400;font-size:24px;color:${C.soft}}
.cap-line{margin-top:6px;max-width:400px;font:400 19px/1.38 'Work Sans';color:${C.soft}}
.credit{margin-top:9px;max-width:400px;font:500 15px/1.4 'Work Sans';color:${C.muted}}
`,
    body: `
<div class="page">
  ${masthead('Before the story')}
  <div class="kicker">One molecule &nbsp;&middot;&nbsp; six plants</div>
  <h2 class="title" data-block>Many plants, <em>one blue.</em></h2>
  ${DIPS}
  <p class="stand" data-block>Indigotin, C<sub>16</sub>H<sub>10</sub>N<sub>2</sub>O<sub>2</sub>, is made by plants in at least four unrelated families. Cultures that never met found their own plant and arrived at the same chemistry.</p>
  <div class="plates" data-block>
    <figure class="fig">
      ${await plate(ehret)}
      <div class="cap-name">True indigo <i>Indigofera tinctoria</i></div>
      <div class="cap-line">A legume, and the source of &ldquo;Indian&rdquo; indigo from Pliny to Bengal.</div>
      <div class="credit">Haid after G. D. Ehret, c. 1750&ndash;53 &middot; Wellcome&nbsp;Collection, public domain</div>
    </figure>
    <figure class="fig">
      ${await plate(bouchard)}
      <div class="cap-name">Woad <i>Isatis tinctoria</i></div>
      <div class="cap-line">A cabbage relative, and Europe&rsquo;s blue until the seventeenth century.</div>
      <div class="credit">Magdalena Bouchard, 1770s &middot; Wellcome&nbsp;Collection, public domain</div>
    </figure>
  </div>
  ${foot()}
</div>`,
  };
};

/* ================================================================
   03-numbers: the four hero figures.

   The same four the page leads with and the share card carries, each set in
   its era's colour so the card reads as the ribbon under it: clay, madder,
   steel, denim. Every one is CONFIRMED; the build fails if that changes.
   ================================================================ */
const numbers = () => {
  const hs = DATA.heroStats;
  if (hs.length !== 4) die(`heroStats has ${hs.length} entries; card 03 is laid out for 4`);
  hs.forEach((s, i) => confirmed(`heroStats[${i}]`, s.source));
  const fall = DATA.footerStats.find((s) => /1924/.test(s.label)) || die('the 1924–25 acreage is gone from footerStats');
  confirmed('the 1924–25 acreage', fall.source);

  const rows = [
    { s: hs[0], fig: '6,000', unit: 'years',
      text: 'since the oldest known indigo-dyed cloth: cotton from Huaca Prieta, on the coast of Peru.',
      cite: 'Splitstoser, Dillehay, Wouters &amp; Claro &middot; <i>Science Advances</i>, 2016',
      must: ['≈6,000', 'oldest indigo-dyed cloth', 'Huaca Prieta'], src: 'Science Advances' },
    { s: hs[1], fig: '1.7', unit: 'million acres',
      text: `under indigo in British India in 1894&ndash;95, the natural crop&rsquo;s peak. By 1924&ndash;25: ${fall.value}.`,
      cite: 'Government of India, Agricultural Statistics, 1901 and 1925',
      must: ['1.7M', 'British India', '1,705,977', '1894–95'], src: 'Agricultural Statistics' },
    { s: hs[2], fig: '10 July', unit: '1897',
      text: 'BASF&rsquo;s synthetic Indigo Pure goes on sale, at 16 marks a kilo against 20 for natural.',
      cite: 'Helmut Schmidt &middot; <i>Chemie in unserer Zeit</i>, 1997',
      must: ['1897', '10 July', '16 marks', '20 for natural'], src: 'Chemie in unserer Zeit' },
    { s: hs[3], fig: '3,781', unit: 'litres',
      text: 'of water per pair of Levi&rsquo;s 501 jeans, 68% of it to grow the cotton.',
      cite: 'Levi Strauss &amp; Co. life-cycle study, 2015',
      must: ['3,781', '501', '68%'], src: 'Levi Strauss' },
  ];
  says('the 1924–25 acreage', `${fall.value} ${fall.label}`, '107,000', '1924–25');
  says('the page description in index.html', INDEX, 'from a Peruvian midden to the denim mill');
  says('the Government of India volumes', list(hs[1].source).concat(list(fall.source)).map((x) => x.title).join(' '),
    'Agricultural Statistics of British India', 'Agricultural Statistics of India, 1924-25');
  const first = DATA.scrollSteps[0];
  says('the first narrative step', `${first.date} ${first.narrative}`, 'c. 4200 BCE', 'Huaca Prieta');
  for (const [i, r] of rows.entries()) {
    says(`heroStats[${i}]`, `${r.s.value} ${r.s.label} ${r.s.sublabel}`, ...r.must);
    if (!list(r.s.source).some((x) => x.institution.includes(r.src) || x.title.includes(r.src))) die(`heroStats[${i}] is no longer sourced to ${r.src}`);
  }

  /* The ribbon is the page's compressed time axis (meta.timeKnots), so each
     era takes the width the page's own charts give it. */
  const knots = DATA.meta.timeKnots, eras = DATA.meta.eras, END = DATA.meta.asOfYear || 2025;
  const pos = (y) => {
    for (let i = 1; i < knots.length; i++) {
      const [p0, y0] = knots[i - 1], [p1, y1] = knots[i];
      if (y <= y1) return p0 + (Math.max(y, y0) - y0) / (y1 - y0) * (p1 - p0);
    }
    return knots[knots.length - 1][0];
  };
  const span = pos(END) - pos(eras[0].start);
  const bands = eras.map((e, i) => {
    const to = i + 1 < eras.length ? eras[i + 1].start : END;
    return { e, w: (pos(to) - pos(e.start)) / span * 100 };
  });

  return {
    id: '03-numbers', file: '03-numbers-4x5-1080x1350.png',
    prepare: () => {
      for (const s of document.querySelectorAll('.band span')) {
        if (s.scrollWidth > s.clientWidth) s.textContent = s.dataset.short;
        if (s.scrollWidth > s.clientWidth) s.textContent = '';
      }
    },
    alt: 'Four figures from the data, each coloured by its era: 6,000 years since the oldest known indigo-dyed cloth, from Huaca Prieta in Peru; 1.7 million acres under indigo in British India in 1894–95; 10 July 1897, when BASF put synthetic indigo on sale; 3,781 litres of water per pair of Levi\'s 501 jeans. A ribbon of the eight eras runs underneath.',
    css: `
.kicker{margin-top:44px}
.title{margin-top:14px;font-size:84px;line-height:.98}
.dips{margin-top:24px}
.rows{margin-top:36px;border-top:1px solid ${C.border}}
.row{display:grid;grid-template-columns:300px 1fr;column-gap:28px;padding:33px 0 32px;border-bottom:1px solid ${C.border}}
.fig{font:700 72px/1 'Work Sans';letter-spacing:-.02em;white-space:nowrap}
.fig small{display:block;margin-top:10px;font:600 17px/1 'Work Sans';letter-spacing:.2em;text-transform:uppercase}
.row p{font:400 25px/1.42 'Work Sans';color:${C.ink};align-self:center}
.row .cite{display:block;margin-top:10px;font:500 16px/1.35 'Work Sans';color:${C.muted}}
.row .cite i{font-style:italic}
.axis{margin-top:40px}
.span{display:flex;justify-content:space-between;font:600 13.5px/1 'Work Sans';letter-spacing:.14em;text-transform:uppercase;color:${C.muted}}
.span b{color:${C.ink};font-weight:700}
/* Era names sit inside their bands, the way the hero's dip strip labels its
   swatches. A band too narrow for its name takes the short form, and one too
   narrow for that goes unlabelled: the compressed axis gives the twentieth
   century little room, and a clipped word would be worse than none. */
.band{display:flex;height:30px;margin-top:10px}
.band span{display:block;height:100%;min-width:0;overflow:hidden;white-space:nowrap;padding-left:8px;
  font:600 11.5px/30px 'Work Sans';letter-spacing:.1em;text-transform:uppercase;color:${C.paper}}`,
    body: `
<div class="page">
  ${masthead('Six millennia')}
  <div class="kicker">Four figures from the data</div>
  <h2 class="title" data-block>From a Peruvian midden<br>to the denim mill.</h2>
  ${DIPS}
  <div class="rows" data-block>
    ${rows.map((r) => `<div class="row">
      <div class="fig" style="color:${C.era[r.s.color]}">${r.fig}<small>${r.unit}</small></div>
      <p>${r.text}<span class="cite">${r.cite}</span></p>
    </div>`).join('')}
  </div>
  <div class="axis" data-block aria-hidden="true">
    <div class="span"><span><b>c. 4200 BCE</b> Huaca Prieta</span><span>compressed time &middot; <b>today</b></span></div>
    <div class="band">${bands.map((b) => `<span style="width:${b.w.toFixed(3)}%;background:${C.era[b.e.slug]}" data-short="${b.e.label.slice(0, 3)}.">${b.e.label}</span>`).join('')}</div>
  </div>
  ${foot()}
</div>`,
  };
};

/* ================================================================
   04-checked: the stories the sources do not support.

   The page's About section names the myths the research could not confirm;
   this card carries the four that have a record in the data, each read back
   from that record. The verdict is the one place madder appears on the
   paper cards: it marks a claim that failed, which is what madder marks on
   the page.
   ================================================================ */
const checked = () => {
  const devil = event('reichspolizeiordnung-teufelsfarb-1577');
  const henri = event('languedoc-indigo-ban-1598');
  const eliz = event('elizabethan-dye-statute-1581');
  const lucas = event('eliza-lucas-wappoo-1744');
  says('the 1577 record', devil.body, 'vitriol', 'The text does not name indigo', 'Saxony 1650', 'the Empire 1654');
  says('the 1598 record', henri.body, 'forbidden in France in 1598', 'no primary text of such an edict was located');
  says('the 1581 record', eliz.body, 'banned logwood', 'woad, or woad and indigo together');
  says('the Eliza Lucas record', lucas.body, 'one of several experimenters', 'enslaved people did the labor');

  const items = [
    { claim: 'The 1577 imperial ban on indigo, &ldquo;the devil&rsquo;s dye&rdquo;', verdict: 'Not indigo',
      text: 'The ordinance banned a dye made with vitriol and never names indigo. The German bans on indigo itself came in 1650 and 1654.' },
    { claim: 'Henri IV&rsquo;s death penalty for dyeing with indigo', verdict: 'No primary text',
      text: 'The research found no text of such an edict. The documented French ban dates from 1598, at the request of the Estates of Languedoc.' },
    { claim: 'Elizabeth I&rsquo;s ban on indigo', verdict: 'Logwood, not indigo',
      text: 'The act of 1581 banned logwood, and it names woad and indigo together as a lawful ground for black.' },
    { claim: 'Eliza Lucas, founder of Carolina indigo', verdict: 'One of several',
      text: 'She was one of several experimenters, and enslaved Africans did almost all of the planting, steeping and beating.' },
  ];
  says('the Carolina step', DATA.scrollSteps.map((s) => s.narrative).join(' '), 'done almost entirely by enslaved Africans');
  says('the 1598 record', henri.body + list(henri.source).map((s) => s.quote).join(' '), 'urgent representation by the states of that province');

  return {
    id: '04-checked', file: '04-checked-4x5-1080x1350.png',
    alt: `Four famous indigo stories the sources do not support: the 1577 "devil's dye" ban, which targeted a vitriol dye; Henri IV's death penalty, for which the research found no edict; Elizabeth I's ban, which was on logwood; and Eliza Lucas as sole founder of Carolina indigo. Below: ${fmt(TALLY.total)} cited data points from ${TALLY.institutions} institutions and ${TALLY.images} rights-cleared images, at ${URL_TEXT}.`,
    css: `
.kicker{margin-top:44px}
.title{margin-top:14px;font-size:84px;line-height:.98}
.dips{margin-top:24px}
.myths{margin-top:28px}
.myth{display:grid;grid-template-columns:50px 1fr;padding:17px 0 18px;border-top:1px solid ${C.border}}
.myth:last-child{border-bottom:1px solid ${C.border}}
.n{font:600 32px/1.1 'Crimson Pro',Georgia,serif;color:${C.muted}}
.claim{font:italic 600 30px/1.12 'Crimson Pro',Georgia,serif;color:${C.ink}}
.verdict{margin-top:8px;font:700 14.5px/1 'Work Sans';letter-spacing:.18em;text-transform:uppercase;color:${C.madder}}
.myth p{margin-top:8px;font:400 21px/1.42 'Work Sans';color:${C.soft}}
.made{margin-top:26px;display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;align-items:end}
.made b{display:block;font:700 46px/1 'Work Sans';letter-spacing:-.02em;color:${C.indigo}}
.made span{display:block;margin-top:8px;font:600 14px/1.3 'Work Sans';letter-spacing:.16em;text-transform:uppercase;color:${C.muted}}
.license{margin-top:16px;font:400 19px/1.45 'Work Sans';color:${C.soft}}`,
    body: `
<div class="page">
  ${masthead('About this project')}
  <div class="kicker">Checked against the sources</div>
  <h2 class="title" data-block>Four famous stories<br>that don&rsquo;t hold up.</h2>
  ${DIPS}
  <div class="myths" data-block>
    ${items.map((m, i) => `<div class="myth"><div class="n">${i + 1}</div><div>
      <div class="claim">${m.claim}</div>
      <div class="verdict">${m.verdict}</div>
      <p>${m.text}</p></div></div>`).join('')}
  </div>
  <div class="made" data-block>
    <div><b>${fmt(TALLY.total)}</b><span>cited data points</span></div>
    <div><b>${TALLY.institutions}</b><span>institutions</span></div>
    <div><b>${TALLY.images}</b><span>rights-cleared images</span></div>
  </div>
  <p class="license" data-block>Every figure carries its source. The data is open, under CC BY 4.0.</p>
  ${foot()}
</div>`,
  };
};

/* ================================================================
   Capture: the landing page at phone width, cut just below the icons.
   ================================================================ */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const CACHE = new Map();
const viaNode = async (page) => {
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
    try {
      if (!CACHE.has(u)) {
        const res = await fetch(u, { headers: { 'user-agent': UA } });
        CACHE.set(u, { status: res.status, type: res.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await res.arrayBuffer()) });
      }
      const c = CACHE.get(u);
      await route.fulfill({ status: c.status, headers: { 'content-type': c.type, 'access-control-allow-origin': '*' }, body: c.body });
    } catch (e) {
      console.error(`  ! ${u}: ${e.message}`);
      await route.abort();
    }
  });
};

/* The cut: 22 css px under the icon row, and it must land before the first
   button, or the mockup would show half a button. Measured, never typed. */
const CUT_BELOW_ICONS = 22;

const captureLanding = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: PHONE.screenW, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await viaNode(page);
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    const loaded = (family) => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded');
    return {
      nav: box('#main-nav'), icons: box('.byline-socials'), buttons: box('.hero-actions'),
      theme: document.documentElement.getAttribute('data-theme') || 'dark',
      fonts: { crimson: loaded('Crimson Pro'), work: loaded('Work Sans') },
      width: document.documentElement.scrollWidth,
    };
  });
  if (!m.nav || m.nav.top !== 0) die('capture: the site header is not at the top of the page');
  if (!m.icons || !m.buttons) die('capture: .byline-socials or .hero-actions is missing from index.html');
  if (!m.fonts.crimson || !m.fonts.work) die('capture: the page rendered without Crimson Pro or Work Sans (is the network reachable? try NODE_USE_ENV_PROXY=1)');
  if (m.width > PHONE.screenW) die(`capture: the page is ${m.width}px wide at a ${PHONE.screenW}px viewport`);
  const cut = Math.ceil(m.icons.bottom + CUT_BELOW_ICONS);
  if (cut >= m.buttons.top) die(`capture: the cut (${cut}) reaches the buttons (${m.buttons.top})`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: PHONE.screenW, height: cut } });
  await ctx.close();
  console.log(`✓ landing page captured  ${PHONE.screenW}x${cut} css px at 3x, ${m.theme} theme, cut ${CUT_BELOW_ICONS}px under the icons`);
  return { uri: `data:image/png;base64,${png.toString('base64')}`, cut };
};

/* ================================================================
   Render and verify.
   ================================================================ */
const html = (c) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>${BASE_CSS}${c.css}</style></head>
<body><div class="card">${c.body}</div></body></html>`;

/* Runs inside the page. Returns a list of problems; empty means the card is sound. */
function audit({ W, H, SAFE_X, SAFE_Y }) {
  const out = [];
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgba = (s) => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
  const bgOf = (el) => {
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none' && e !== document.body) return { unknown: e.className };
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    return { rgb: layers.reverse().reduce((acc, c) => over(c, acc), [255, 255, 255]) };
  };
  const label = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 40)}"`;

  /* fonts: every face a line of text is set in must actually have loaded */
  const faces = new Set();
  for (const e of document.querySelectorAll('.card *')) {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(e);
    faces.add(`${cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()}|${cs.fontWeight}|${cs.fontStyle}`);
  }
  for (const key of faces) {
    const [family, weight, style] = key.split('|');
    const ok = [...document.fonts].some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded' && f.style === style &&
      (String(f.weight).includes(' ') ? +String(f.weight).split(' ')[0] <= +weight && +weight <= +String(f.weight).split(' ')[1] : +f.weight === +weight));
    if (!ok) out.push(`font not loaded: ${family} ${weight} ${style}`);
  }
  for (const im of document.images) if (!im.complete || !im.naturalWidth) out.push(`image did not load: ${im.className}`);

  const textEls = [...document.querySelectorAll('.card *')].filter((e) =>
    [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(e).visibility !== 'hidden');
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    /* contrast, against the colour actually behind the text */
    const bg = bgOf(el);
    if (bg.unknown !== undefined) { out.push(`text on a gradient or image, contrast unverifiable: ${label(el)}`); continue; }
    const fg = over(rgba(cs.color), bg.rgb);
    const L1 = lum(fg), L2 = lum(bg.rgb);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    let zoom = 1;
    for (let a = el; a; a = a.parentElement) zoom *= parseFloat(getComputedStyle(a).zoom) || 1;
    const px = parseFloat(cs.fontSize) * zoom;
    const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) out.push(`contrast ${ratio.toFixed(2)}:1 < ${large ? 3 : 4.5} for ${label(el)}`);
    /* the crop-safe frame, measured on the glyphs themselves */
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) {
        if (b.left < SAFE_X - 0.5 || b.right > W - SAFE_X + 0.5 || b.top < SAFE_Y - 0.5 || b.bottom > H - SAFE_Y + 0.5)
          out.push(`outside the safe frame (${Math.round(b.left)},${Math.round(b.top)} to ${Math.round(b.right)},${Math.round(b.bottom)}): ${label(el)}`);
      }
    }
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && cs.display !== 'inline') out.push(`text overflows its box: ${label(el)}`);
  }
  /* nothing may leave the card, bar the pieces that bleed on purpose */
  for (const el of document.querySelectorAll('.card *')) {
    if (el.closest('[data-bleed]') || el.closest('.phone')) continue;
    const r = el.getBoundingClientRect();
    if (r.width && (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5)) out.push(`leaves the card: ${label(el)}`);
  }
  /* the major blocks must not touch */
  const blocks = [...document.querySelectorAll('[data-block]')].map((e) => ({ e, r: e.getBoundingClientRect() }));
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i].r, b = blocks[j].r;
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`blocks overlap: ${label(blocks[i].e)} / ${label(blocks[j].e)}`);
  }
  return out;
}

/* No glyph may be drawn by a system fallback: ask Chrome which fonts it
   actually used for every text node. A "≈" or a subscript digit missing from
   the web font would otherwise render in whatever the machine has. */
const fallbackGlyphs = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.card *' });
  const bad = new Map();
  for (const nodeId of nodeIds) {
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }).catch(() => ({ fonts: [] }));
    for (const f of fonts) if (!f.isCustomFont) bad.set(f.familyName, (bad.get(f.familyName) || 0) + f.glyphCount);
  }
  await cdp.detach();
  return [...bad].map(([name, n]) => `${n} glyph(s) fell back to the system font "${name}"`);
};

const ALT = new Map();
const render = async (browser, card) => {
  ALT.set(card.id, { file: card.file, alt: card.alt });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  await viaNode(page);
  await page.setContent(html(card), { waitUntil: 'networkidle', timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);
  if (card.prepare) await page.evaluate(card.prepare);
  const problems = [...await page.evaluate(audit, { W, H, SAFE_X, SAFE_Y }), ...await fallbackGlyphs(page)];
  if (problems.length) {
    await page.screenshot({ path: path.join(HERE, `${card.id}.failed.png`) });
    die(`${card.file}\n    ${problems.join('\n    ')}\n  (the failed render is in ${card.id}.failed.png)`);
  }
  const big = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  await ctx.close();
  const out = path.join(HERE, card.file);
  await sharp(big).resize(W, H, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(out);
  fs.rmSync(path.join(HERE, `${card.id}.failed.png`), { force: true });
  console.log(`✓ ${card.file}  ${W}x${H}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB  (fonts, contrast, safe frame, overflow, overlap)`);
};

/* ─── alt-text.md: one entry per slide, for the alt text Instagram takes
   per image under a post's accessibility settings. Generated with the cards. ─── */
const writeAlt = () => {
  const lines = ['# Alt text, one per slide', '',
    'Generated by `build-cards.mjs` with the cards, so the figures match them. Paste each into',
    'its slide in the post\'s advanced settings, under Accessibility, before posting.', ''];
  for (const [i, id] of CARDS.entries()) {
    const a = ALT.get(id);
    lines.push(`## ${i + 1}. \`${a.file}\``, '', a.alt, '');
  }
  fs.writeFileSync(path.join(HERE, 'alt-text.md'), lines.join('\n'));
  console.log('✓ alt-text.md');
};

/* ─── check: the files on disk are the right size and not blank ─── */
const CARDS = ['01-site', '02-plants', '03-numbers', '04-checked'];
const fileOf = (id) => `${id}-4x5-1080x1350.png`;
const check = async () => {
  let bad = 0;
  for (const id of CARDS) {
    const f = path.join(HERE, fileOf(id));
    if (!fs.existsSync(f)) { console.error(`✗ ${fileOf(id)} is missing`); bad++; continue; }
    const meta = await sharp(f).metadata();
    const { channels } = await sharp(f).stats();
    const spread = Math.max(...channels.slice(0, 3).map((c) => c.stdev));
    const problems = [];
    if (meta.width !== W || meta.height !== H) problems.push(`is ${meta.width}x${meta.height}, not ${W}x${H}`);
    if (meta.format !== 'png') problems.push(`is ${meta.format}, not png`);
    if (spread < 12) problems.push(`looks blank (channel stdev ${spread.toFixed(1)})`);
    if (problems.length) { bad++; console.error(`✗ ${fileOf(id)} ${problems.join('; ')}`); }
    else console.log(`✓ ${fileOf(id)}  ${meta.width}x${meta.height}`);
  }
  if (bad) die(`${bad} card(s) failed`);
  console.log('✓ all four cards present and sound');
};

/* ─── proof: the carousel as the feed shows it, and the cover as the
   profile grid crops it to 3:4. A proof, not a deliverable: gitignored. ─── */
const proof = async (browser) => {
  for (const id of CARDS) if (!fs.existsSync(path.join(HERE, fileOf(id)))) die(`${fileOf(id)} not built yet`);
  const uri = (id) => img(path.join(HERE, fileOf(id)), 'image/png');
  const tile = 390, tileH = Math.round(tile * H / W), gridW = 130;
  const page = await browser.newPage({ viewport: { width: 4 * tile + 5 * 16 + gridW * 3 + 40, height: tileH + 90 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>
body{margin:0;background:#fff;font:13px/1.3 system-ui,sans-serif;color:#555;display:flex;gap:16px;padding:16px;align-items:flex-start}
figure{margin:0}img{display:block}figcaption{margin-top:6px}
.feed img{width:${tile}px;height:${tileH}px;border:1px solid #ddd}
.grid{display:grid;grid-template-columns:repeat(3,${gridW}px);gap:2px}
.grid div{width:${gridW}px;height:${Math.round(gridW * 4 / 3)}px;background:#eee;overflow:hidden}
.grid img{width:100%;height:100%;object-fit:cover}</style>
${CARDS.map((id, i) => `<figure class="feed"><img src="${uri(id)}"><figcaption>${i + 1}/4 in the feed, at a phone's width</figcaption></figure>`).join('')}
<figure><div class="grid"><div></div><div><img src="${uri(CARDS[0])}"></div><div></div></div><figcaption>the cover in the 3:4 profile grid</figcaption></figure>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(HERE, 'proof.png'), fullPage: true });
  await page.close();
  console.log('✓ proof.png  the feed at 390 px and the profile-grid crop');
};

/* ─── CLI ─── */
const args = process.argv.slice(2);
if (args[0] === 'check') { await check(); process.exit(0); }
const browser = await chromium.launch();
try {
  if (args[0] === 'proof') { await proof(browser); }
  else {
    for (const a of args) if (!CARDS.includes(a)) die(`unknown card "${a}". Try: ${CARDS.join(', ')}, check, proof`);
    const want = args.length ? args : CARDS;
    const screen = want.includes('01-site') ? await captureLanding(browser) : null;
    const make = { '01-site': () => cover(screen), '02-plants': plants, '03-numbers': numbers, '04-checked': checked };
    for (const id of want) await render(browser, await make[id]());
    if (!args.length) { writeAlt(); await check(); await proof(browser); }
  }
} finally {
  await browser.close();
}
