# Indigo: The Blue That Dyed the World

An open-data, scrollytelling data-journalism site on **six thousand years of indigo** — from indigo-dyed cotton at Huaca Prieta, Peru (about 6,200–6,000 years old) to the denim mill. It is a domain fork of [`fritzhand/history-of-tampa`](https://github.com/fritzhand/history-of-tampa) (*Downtown Tampa: A Civic Development Autopsy*), itself a fork of [`fritzhand/iranwar`](https://github.com/fritzhand/iranwar): same architecture, same citation standard, a different subject and a planet-sized study area.

**Live:** <https://fritzhand.github.io/history-of-indigo/>

Published with GitHub Pages from the repository root. Every asset path is relative, so the site works unchanged under the `/history-of-indigo/` project subpath.

## What you get

| Layer | Implementation |
| --- | --- |
| The molecule | Six dye plants from four unrelated families, and a four-stage leaf-to-cloth vat diagram |
| Narrative scrollytelling map | Leaflet world map + IntersectionObserver steps (`js/app.js`): twenty-one moments, c. 4200 BCE to 2018 |
| Cited data layer | `js/data.js` — `window.indigoData`, compiled from `research/*.json` by `tools/build-data.mjs` |
| Spread chart | Every mapped event by continent and era on a compressed time axis |
| Interactive year scrubber | c. 4500 BCE → 2025 on the same compressed axis; the map fills in as evidence begins, and trade cards name the year each figure is from |
| Trade charts | Carolina & Georgia exports, three Atlantic suppliers, Saint-Domingue's shift to sugar, India 1795–1924, British India acreage, Britain's natural-vs-synthetic import bill, price indices, Tokushima's collapse, world output estimates, the water in a pair of jeans |
| Flow diagrams | Custom SVG sankeys — one Dutch fleet (1631), India at the peak (1896–97), today's synthetic chain |
| Human cost | "Who Grew the Blue": coerced and enslaved labour, debt bondage, tinkathia, factory job losses and denim pollution, each row cited |
| Region impact matrix | Who profited, who paid and who kept the craft, from Toulouse to Tennessee |
| Open picture archive | Rights-cleared images (public domain / CC0 / CC BY / CC BY-SA), each credited, filterable by era |
| Live source audit | Every institution, its data points, and their verification status |
| Light / dark theme | Night-vat dark and unbleached-cotton light, remembered between visits |
| Share metadata | Open Graph, Twitter Card and schema.org Article, with a rendered 1200×630 card |
| Scroll assist, section drawer | Carried over from the Tampa study |

## Run locally

A static site with no build step for the reader. From the repo root:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Map tiles, fonts and CDN libraries need network access.

## How the data is made

```
research/*.json          the research pass: events, series, quantities, plants,
                         images — every record with source objects that carry
                         the exact quote supporting it
tools/editorial.mjs      the judgement layer: eras, which events are mapped,
                         narrative steps, charts, sankey models, tables
tools/build-data.mjs     compiles both into js/data.js
```

`js/data.js` is generated; edit the research or the editorial layer and rebuild. The build computes each event's era from its year, matches free-text point citations to their source objects, and marks every unit conversion, index and remainder as DERIVED with a note naming its inputs.

## Tools

```bash
node tools/build-data.mjs                          # research + editorial -> js/data.js
python3 tools/assemble-page.py                     # refresh the counts quoted in the share metadata
node tools/validate-data.mjs                       # schema, eras, renderer contract, hero rule
NODE_USE_ENV_PROXY=1 node tools/check-links.mjs    # every source URL, grouped by outcome
node tools/media-roll.mjs                          # regenerate the CONTENT_LICENSE media table
node tools/check-meta.mjs                          # Open Graph / Twitter / JSON-LD
node tools/render-card.mjs                         # rebuild assets/og-image.png from tools/og-card.html
node collateral/instagram-2026-09/build-cards.mjs  # the Instagram launch set: four 4:5 cards, checked
```

`render-card.mjs` and `build-cards.mjs` need `playwright` and `sharp` available to node.

## Collateral

Social sets live in `collateral/`, one folder per set: its builder, a README recording where
every figure and image on the cards comes from, the post copy and the alt text. The cards are
generated from the page and from `js/data.js`, so edit the builder and rebuild rather than touching
a PNG.

| Set | Cards |
|---|---|
| [`collateral/instagram-2026-09/`](./collateral/instagram-2026-09/) | Four 1080×1350 cards for the launch post: the landing page on a phone, *Many plants, one blue*, the four hero figures, and four famous stories that don't hold up |

## Historical arc (eras)

1. **Ancient** (to 500 CE) — Huaca Prieta, Egypt, Babylonian recipes, Maya Blue, Rome's *indicum*
2. **Medieval** (500–1497) — the Qimin yaoshu, the Shōsōin, Tellem cloth, Gujarat's exports, Europe's woad towns
3. **Sea Routes** (1498–1649) — da Gama, the woad wars, Guatemala's obrajes, the Dutch and English companies
4. **Plantation** (1650–1789) — Saint-Domingue, Carolina, the bounty, indigo cloth in the slave trade
5. **Empire** (1790–1896) — Bengal, the Indigo Revolt, Bihar and tinkathia, Kano, Baeyer's synthesis
6. **Synthetic** (1897–1945) — BASF's Indigo Pure, the collapse of plant indigo, Champaran
7. **Denim** (1946–1999) — jeans go global; Japanese denim; microbes that make indigo
8. **Revival** (2000–today) — production moves to China, polluted rivers, plant indigo and bio-indigo return

Era boundaries are editorial and each opens at a cited event (see `meta.eras` notes).

## Citation standard

Every figure in `js/data.js` carries:

```js
source: {
  institution: "...",
  title: "...",
  date: "YYYY-MM-DD",
  url: "https://...",
  quote: "...",                    // the sentence that supports the figure, where one exists
  note: "...",                     // optional
  verificationStatus: "CONFIRMED", // or PENDING | DERIVED
  accessType: "FREE"               // or REGISTRATION | PAYWALL | API
}
```

- Prefer primary institutions: peer-reviewed archaeology and chemistry, museum records, government statistical series (Historical Statistics of the United States; Government of India agricultural and trade statistics; the Imperial Gazetteer), parliamentary and commission evidence, patents, NobelPrize.org, UNESCO.
- Hero and footer numbers must be `CONFIRMED`.
- Popular claims that did not survive checking — the 1577 "devil's dye" ban, Henri IV's death penalty, Elizabeth I's indigo ban, Eliza Lucas as sole founder, "Japan Blue" in 1875 — are named as such on the page.

## Planning documents

| File | Purpose |
|---|---|
| [`ARCHIVAL_RESEARCH_PROMPT_INDIGO.md`](./ARCHIVAL_RESEARCH_PROMPT_INDIGO.md) | Research brief for the next evidence pass |
| [`PROGRESS.md`](./PROGRESS.md) | Done / not-done checkpoint for resume |
| [`CONTENT_LICENSE.md`](./CONTENT_LICENSE.md) | Data license, media rights policy, media roll |

## Design

Editorial, after the Tampa and Iran War studies: Crimson Pro for headlines, Work Sans for body, labels and numbers, and a restrained palette where colour means something. Indigo is the primary accent and madder red — the dye indigo was sold beside for millennia — marks the crisis figures. A six-step "dip ramp" from pale to deep blue carries the mark, the hero ribbon and the vat diagram: indigo darkens by repeated dipping, not by a stronger bath. The eight eras are named colours: clay, woad-flower gold, sea teal, the violet-bronze sheen of an indigo cake, madder, chemical steel, denim and leaf green.

The whole palette lives in `css/styles.css` as custom properties, once for each theme; `js/app.js` reads it from there, so charts, map markers, sankeys and stat cards follow the theme toggle.

## Built with

Leaflet · Chart.js · Esri World Dark Gray and Light Gray Canvas tiles · Crimson Pro / Work Sans

## Credit

Research, data and build by Jeremy Fritzhand
([GitHub](https://github.com/fritzhand) ·
[LinkedIn](https://www.linkedin.com/in/fritzhand/)), with Claude Code.
