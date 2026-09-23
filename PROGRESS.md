# Progress — Indigo: The Blue That Dyed the World

**Repository:** `fritzhand/history-of-indigo`
**Branch:** `claude/ecstatic-ptolemy-93k4oh`
**Last updated:** 2026-09-23

A domain fork of `fritzhand/history-of-tampa` (the Downtown Tampa study),
built in one pass: a research sweep in five parallel slices, then the site.

---

## Where the project stands

The site runs end to end. Every section renders from the cited data layer in
both themes and at phone width, the validator reports no errors, and the
share card and metadata are in place. The remaining work is evidentiary: the
gaps are listed in `ARCHIVAL_RESEARCH_PROMPT_INDIGO.md`.

| Layer | Status | Notes |
|---|---|---|
| Research pass | **done** | Five slices in `research/`: ancient & medieval, colonial Atlantic, India/Asia/Africa, synthetic & modern, images. Every record carries source objects with the supporting quote |
| Data build | **done** | `tools/build-data.mjs` + `tools/editorial.mjs` → `js/data.js`; eras computed from years, conversions and indices marked DERIVED |
| Narrative map | **done** | 116 mapped events, 21 scrollytelling steps from c. 4200 BCE to 2018 |
| Spread chart & scrubber | **done** | Compressed time axis shared by the chart and the slider; the map fills in as evidence begins |
| Trade charts | **done** | Atlantic, India, synthetic crossover, Japan, modern output, water per pair |
| Sankeys | **done** | 1631 VOC fleet (itemised), 1896–97 India (province → market, remainders DERIVED), today's shares (DERIVED) |
| Human cost & region matrix | **done** | Ten labour rows and thirteen regions, each cited |
| Picture archive | **done** | 50 images (17 public domain, 16 CC0, 15 CC BY-SA, 2 CC BY) from The Met, Cleveland, Wellcome and Wikimedia Commons; every license read on its record and quoted in `rightsEvidence`; thumbnails mirrored in `assets/media/` |
| Source audit | **done** | Live tally in the page |
| Share card & metadata | **done** | `tools/og-card.html` → `assets/og-image.png`; `tools/check-meta.mjs` passes |

## Citation status

Counted by `node tools/validate-data.mjs` (and live on the page):

| Verification status | Source objects |
|---|---|
| CONFIRMED | 536 |
| PENDING | 24 |
| DERIVED | 146 |

Source objects are merged per document within a record, so a record that
quotes one paper twice counts that paper once.

DERIVED is large by design: every unit conversion (livres, maunds and
hundredweights to tonnes), every price index and every editorial remainder
is marked DERIVED even when its input is CONFIRMED.

## Link audit (2026-09-23)

`tools/check-links.mjs` over `js/data.js`: 308 URLs, 250 answer, 36 are
rate-limited or bot-gated (Wikimedia originals, Britannica, Wiley,
ScienceDirect, LOC) and resolve in a browser. The rest needing attention are
bot blocks on Levi Strauss & Co., the British Museum, MDPI and Academia, a
429 burst from The Met, two slow hosts (lescij.org, eguizhou.gov.cn) and an
expired certificate on the University of Costa Rica repository (kerwa.ucr.ac.cr).
The one genuinely dead link, to this repository's own `main` branch, now
points at `HEAD`.

## Corrections the research pass made to the popular story

- The 1577 imperial "devil's dye" ban targeted a vitriol-based colour, not
  indigo; the German indigo bans are Saxony 1650 and the Empire 1654.
- No primary text supports Henri IV's 1609 death penalty for indigo; the
  documented French ban is 1598, at the request of the Estates of Languedoc.
- England's 1581 dye act targeted logwood and names woad-and-indigo as lawful.
- South Carolina's 1775 "peak" of 1,122,200 lb covers 6½ months.
- US Patent 139,121 (1873) was issued to Jacob W. Davis as assignor to
  himself and Levi Strauss & Co., not jointly.
- The 1993 microbial-indigo paper (Murdock et al.) is in *Bio/Technology*,
  from Amgen; the first E. coli indigo report is Ensley et al., *Science*, 1983.
- "Japan Blue" (Atkinson, 1875) could not be traced to a primary text.

## Next

1. Close Tier 1 gaps in the research brief: British imports by origin,
   an annual Guatemalan series, German synthetic exports by year, a primary
   modern production statistic.
2. Replace PENDING citations with primary reads (the Babylonian tablet record,
   Tellem dating, Hallstatt shares).
3. A LinkedIn carousel from the same palette, following the Tampa pipeline.
