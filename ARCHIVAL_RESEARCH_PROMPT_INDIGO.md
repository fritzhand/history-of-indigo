# Archival Research Brief — Indigo: The Blue That Dyed the World

The next evidence pass. Every item below is a named gap on the live site: a
figure marked PENDING or DERIVED where a primary record should exist, a
series with holes, or a claim the first pass could not verify. Close them
against primary institutions and record each result in `research/*.json`
with the exact supporting quote, then rebuild (`node tools/build-data.mjs`).

## Standard

- One source object per figure: `institution`, `title`, `date`, `url`,
  `quote`, `verificationStatus`, `accessType`.
- CONFIRMED only when the fetched page (or scan) states the figure. Record
  OCR uncertainty in `note`.
- Prefer, in order: the primary document; an official statistical series;
  peer-reviewed scholarship; a museum or archive catalogue; reputable press.
  Wikipedia is a lead, never a source.

## Tier 1 — quantitative gaps

1. **British indigo imports by origin, c. 1700–1800.** Customs ledgers
   (TNA CUST 3 and CUST 17), or Schumpeter's *English Overseas Trade
   Statistics 1697–1808*. Needed to size Carolina, the Caribbean, Guatemala
   and Bengal against one another in a single unit.
2. **Annual Guatemala/San Salvador indigo exports, 1700–1820.** R. S. Smith
   (1959, *HAHR*), Fernández Molina (2003), and Guatemalan alcabala series in
   the AGCA. The current series mixes harvests, exports and period averages.
3. **East India Company and VOC indigo imports, 1600–1700.** Chaudhuri,
   *The Trading World of Asia and the English East India Company*; the VOC
   *Generale Missiven*. One VOC fleet (1631) is the only itemised cargo now.
4. **Bengal indigo 1832–1890.** Bridge the gap between Phipps's 1795–1832
   series and the 1876 start of the British India export series (Calcutta
   Custom House returns; *Statistical Abstract relating to British India*).
5. **German synthetic indigo exports, 1897–1914, by year.** German foreign
   trade statistics (*Statistik des Deutschen Reichs*), BASF and Hoechst
   annual reports. Only 1904 and 1913 are in hand.
6. **Modern production.** Any primary statistic for world synthetic indigo
   output and China's share (China Dyestuff Industry Association; USITC
   investigation 731-TA-851 staff report, which returned HTTP 403 to the
   first pass). Published estimates range from 50,000 to 88,000 t/yr.
7. **Enslaved labour on indigo, quantified.** Enslaved populations on
   indigo-producing parishes and plantations in Saint-Domingue (Moreau de
   Saint-Méry; the 1780s censuses) and South Carolina (inventories).

## Tier 2 — claims to verify or retire

- The Fifth Dynasty Egyptian indigo linen (c. 2400 BCE): findspot, museum
  number, and whether the analysis identifies woad or Indigofera.
- The Babylonian dye tablet (BM 62788+82978): the British Museum collection
  record returned an error; read its wording.
- Cairo Geniza T-S 12.468: does the 978 record's "isatis called Syrian nīl"
  mean woad rather than Indian indigo? Needs a specialist reading.
- Tellem: the Met's "about 500 carbon-dated textiles from 13 contexts" —
  confirm against Bolland's *Tellem Textiles* (1991).
- Hallstatt: indigotin in 33% of Bronze Age and 58% of Iron Age textiles
  (paywalled abstract).
- Louis Bonnaud (c. 1777) as Bengal's first European planter.
- R. W. Atkinson and "Japan Blue" (1875): locate the primary text or retire.
- Henri IV's 1609 death penalty for indigo: no primary text found; a French
  royal edict of that date would settle it.
- El Salvador's añil revival (1990s–2000s): an institutional source.
- Kano, Kofar Mata, 1498: any source beyond tradition.

## Tier 3 — images

Rights-cleared images for the gaps listed in `research/media.json` notes.
Only public domain, CC0, CC BY or CC BY-SA; record the rights statement seen
on the record page in `rightsEvidence`.
