# Instagram launch set, September 2026

Four 1080×1350 (4:5) cards announcing *Indigo: The Blue That Dyed the World*, built by
[`build-cards.mjs`](./build-cards.mjs) from the page itself and from the data layer. They make
one carousel, in the order below. The caption is in [`caption.md`](./caption.md) and the alt text
for each slide in [`alt-text.md`](./alt-text.md).

| # | File | Carries |
|---|---|---|
| 1 | `01-site-4x5-1080x1350.png` | The landing page on a phone, from the site header to just below the GitHub and LinkedIn icons under the byline. Title *Indigo*, the site's address. |
| 2 | `02-plants-4x5-1080x1350.png` | *Many plants, one blue.* Ehret's true indigo and Bouchard's woad, two public-domain plates, shown whole. |
| 3 | `03-numbers-4x5-1080x1350.png` | *From a Peruvian midden to the denim mill.* The page's four hero figures, each in its era colour, over the eight-era ribbon. |
| 4 | `04-checked-4x5-1080x1350.png` | *Four famous stories that don't hold up.* Four myths the research could not confirm, and what the project is made of. |

The PNGs are generated. To change a card, edit `build-cards.mjs` and rebuild: a PNG edited by hand
skips the checks below and is overwritten by the next build.

## Build

```bash
node collateral/instagram-2026-09/build-cards.mjs              # all four cards, alt text, check, proof
node collateral/instagram-2026-09/build-cards.mjs 03-numbers   # one card
node collateral/instagram-2026-09/build-cards.mjs check        # re-read the PNGs on disk
node collateral/instagram-2026-09/build-cards.mjs proof        # the carousel as the feed shows it
```

It needs `playwright` and `sharp` available to node, like `tools/render-card.mjs`, and network
access for Google Fonts and the page's CDN scripts. Behind a proxy, prefix `NODE_USE_ENV_PROXY=1`:
every remote request is fulfilled through node's `fetch`, as in `tools/check-links.mjs`.

Each card renders at 2× in headless Chromium and is downsampled to 1080×1350 with lanczos3. The
phone screen is not a stored screenshot: every build loads `index.html` at 390 css px, 3× density,
and cuts the page 22 px below the icon row, measured from the DOM. The build stops if that cut
would reach the first button, so the mockup can never show half a button.

`proof.png` (gitignored) lays the four cards out at a phone's width and shows the cover in the
3:4 profile grid. A card that fails its checks is written as `<id>.failed.png` (also gitignored)
so the fault can be seen.

### What the build refuses to write

Every card is audited in the browser before it becomes a PNG. The build stops if:

- **a glyph falls back to a system font.** Chrome is asked which fonts it actually used for every
  text node (`CSS.getPlatformFontsForNode`); anything that is not a loaded web font fails. A `≈`
  or a subscript digit missing from Work Sans would otherwise render in whatever the machine has.
  That is why card 03 reads *6,000 years* rather than the page's *≈6,000*.
- **a face did not load**, in the weight and style a line is set in.
- **any line of text is under WCAG AA** (4.5:1, or 3:1 at 24 px and up) against the colour behind it,
  composited through every translucent layer.
- **any glyph sits outside the crop-safe frame**: 64 px from each side, 40 px top and bottom. The
  feed shows a 4:5 post whole, but the profile grid shows it as a 3:4 tile, which takes 34 px off
  each side. 64 keeps every letter 30 px clear of that edge.
- **text overflows its box, an element leaves the card, or two blocks overlap.**
- **a figure no longer matches its record.** See below.

## Where every fact comes from

Nothing on a card is typed twice. Card figures are read from `js/data.js` at build time, and each
card asserts that the record it quotes still says what the card says: change the data and the
build fails with the words that no longer match, rather than posting a card that contradicts the
site.

| On the card | Record |
|---|---|
| *706 cited data points*, *150 institutions* (01, 04) | Counted by walking `window.indigoData` exactly as `buildSourceRoll()` in `js/app.js` does, so the card and the page's Source Audit agree. |
| *50 rights-cleared images* (04) | `mediaAssets.length` |
| *Indigo* / *The Blue That Dyed the World* (01) | The page's `<title>` |
| The phone screen (01) | A capture of `index.html` taken during the build |
| C₁₆H₁₀N₂O₂ (02) | `chemistry.formula`, PubChem, CONFIRMED |
| *made by plants in at least four unrelated families. Cultures that never met found their own plant and arrived at the same chemistry.* (02) | The molecule section of `index.html`, verbatim |
| Legume, "Indian" indigo, Pliny, Bengal (02) | `plants` → `indigofera-tinctoria` |
| Cabbage relative, Europe's blue until the seventeenth century (02) | `plants` → `isatis-tinctoria` |
| *From a Peruvian midden to the denim mill.* (03) | The page's description in `index.html` |
| 6,000 years, Huaca Prieta (03) | `heroStats[0]`, *Science Advances* 2016 (Splitstoser, Dillehay, Wouters, Claro), CONFIRMED |
| 1.7 million acres, 1894–95 (03) | `heroStats[1]`, *Agricultural Statistics of British India*, CONFIRMED |
| 107,000 acres by 1924–25 (03) | `footerStats`, *Agricultural Statistics of India, 1924-25*, CONFIRMED |
| 10 July 1897, 16 against 20 marks a kilo (03) | `heroStats[2]`, Helmut Schmidt, *Chemie in unserer Zeit* 1997, CONFIRMED |
| 3,781 litres, 68% to grow the cotton (03) | `heroStats[3]`, Levi Strauss & Co. life-cycle study 2015, CONFIRMED (see open items) |
| The era ribbon (03) | `meta.eras` on the page's compressed axis, `meta.timeKnots` |
| The 1577 "devil's dye" (04) | `mapEvents` → `reichspolizeiordnung-teufelsfarb-1577` |
| Henri IV and the 1598 ban (04) | `mapEvents` → `languedoc-indigo-ban-1598` |
| Elizabeth I and logwood (04) | `mapEvents` → `elizabethan-dye-statute-1581` |
| Eliza Lucas, one of several; enslaved Africans did almost all of the work (04) | `mapEvents` → `eliza-lucas-wappoo-1744`, and the Carolina step in `scrollSteps` |

Card 04 takes four of the five myths named under *Myths this project could not confirm* on the
page. The fifth, "Japan Blue" as a nineteenth-century coinage, has no record in the data to read
back, so it stays on the page and off the card.

## Images

| Card | Image | Rights |
|---|---|---|
| 01 | The site's own page, including the author photo `assets/jeremy.jpg` as the byline shows it | The project's own work |
| 02 | *Indigo plant (Indigofera tinctoria)*, engraved by J. J. or J. E. Haid after Georg Dionysius Ehret, c. 1750–53 ([record](https://wellcomecollection.org/works/w8h22sfg)) | Wellcome Collection, Public Domain Mark |
| 02 | *Woad (Isatis tinctoria)*, etched by Magdalena Bouchard for Giorgio Bonelli, 1770s ([record](https://wellcomecollection.org/works/mgxh3v2a)) | Wellcome Collection, Public Domain Mark |

Both plates are the mirrored copies in `assets/media/`, and the build asserts that their records
still say *Public domain*. Neither carries conditions; they are credited on the card anyway, as
the site credits every image. Only public-domain images are used, so no card inherits a
share-alike term.

## Why the cards look the way they do

- **Deep indigo cover, paper inside.** The cover's ground is the last step of the dip ramp,
  `#18234F`: the card is the colour the page is about, and it stands out in a feed. The three
  cards behind it are the site's light theme, unbleached cotton, like pages behind a cover.
- **The whole phone, not a cropped screen.** The requested crop, header to just below the icons,
  is 712 css px of page. With a 50 px status bar and an 84 px browser bar that makes a 390×846
  screen: the proportions of a 6.1-inch phone. So the device is drawn whole, and its address bar
  names the site.
- **Dark theme on the phone.** It is the page's default, so it is what a visitor meets first.
- **One shadow.** The phone is the one object that stands off the page; nothing else floats.
- **Type.** Crimson Pro for display and Work Sans for everything else, the page's own pair.
- **One accent.** Indigo (`#2E3F9E`) carries the kickers, the address and card 04's totals. Madder
  appears only as card 04's verdicts, marking claims that failed, which is what it marks on the page.
- **The dip strip under every paper title.** It is the page's thesis in one picture (indigo
  deepens by repetition, not a stronger bath), and it is on the hero and the share card too.
- **Whole plates.** Cropping an engraving to fill a box cuts its lettering, so both plates hang
  at their own proportions from a two-column grid. Type never sits on an image.
- **Era names inside the ribbon.** That is how the hero's dip strip labels its swatches. A band
  too narrow for its name takes a short form (*Syn.*, *Den.*), and Revival, 2.6% of the axis, goes
  unlabelled; a clipped word would be worse than none.
- **No em dashes in new copy.** The phone shows the page's own sentences as they are.

## Open items for the author

1. **The 68% on card 03.** The site's hero sublabel and the record body
   (`levis-501-lifecycle-assessment`) give cotton growing 68% of the 3,781 litres, from the same
   Levi's life-cycle deck, but the stored source quote carries only the total. Add the breakdown to
   that quote in `research/`, or cut "68% of it to grow the cotton" from the card.
2. **The link.** Instagram does not link from captions. Put
   `fritzhand.github.io/history-of-indigo` in the bio before posting, or add a link sticker to a
   Story that shares the post.
3. **Alt text.** Paste each entry in `alt-text.md` into the matching slide, in the post's
   advanced settings under Accessibility.
