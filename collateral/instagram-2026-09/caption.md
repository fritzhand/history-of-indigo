# The post copy

The four cards make one carousel, in order: `01-site`, `02-plants`, `03-numbers`, `04-checked`.
Paste the alt text from [`alt-text.md`](./alt-text.md) into each slide (in the post's advanced
settings, under Accessibility) before sharing. The cards carry headlines and figures; the caption
carries the sentences.

Every figure below is on the cards or the page, from the records listed in
[`README.md`](./README.md). If the data changes, rebuild the cards and check these numbers
against `alt-text.md`, which the build regenerates.

---

## Caption

> *Indigo: The Blue That Dyed the World* is up.
>
> It's an open-data history of one molecule. Indigotin comes from half a dozen unrelated plants,
> and cultures that never met each found their own. The story runs from cotton dyed about 6,000
> years ago at Huaca Prieta, Peru, through temples, guilds, sea routes, slave plantations, a
> peasant revolt and a German chemistry lab, to the denim mill.
>
> Scroll the world map through 21 moments, or drag the year slider across six thousand years and
> watch the map fill in as the evidence begins.
>
> Every figure carries its source: 706 cited data points from 150 institutions, each marked
> confirmed, pending or derived. The 50 images are public domain or openly licensed, and each one
> is credited. The data is open under CC BY 4.0.
>
> A few of indigo's best-known stories didn't survive the research. The 1577 "devil's dye" ban was
> aimed at a dye made with vitriol, and Elizabeth I's act of 1581 banned logwood, not indigo. The
> last slide has four of them.
>
> Link in bio: fritzhand.github.io/history-of-indigo

**Hashtags.** Keep it to a handful:

`#indigo #naturaldye #textilehistory #denim #woad #datajournalism`

---

## Short version, for a Story or a repost

> Six thousand years of the world's blue, from a Peruvian midden to the denim mill. 706 cited
> data points, 50 rights-cleared images, open data. fritzhand.github.io/history-of-indigo

---

## Where the caption's facts come from

| In the caption | Source on the page |
|---|---|
| Half a dozen unrelated plants; cultures that never met | The hero standfirst and the molecule section |
| About 6,000 years, Huaca Prieta | `heroStats[0]` (card 03) |
| Temples, guilds, sea routes, slave plantations, a peasant revolt, a German chemistry lab | The hero standfirst, verbatim list |
| 21 moments | `scrollSteps` (21 entries): the narrative map |
| The year slider fills the map as evidence begins | The year scrubber (`#sandbox`): "Drag the slider and the map fills in" |
| 706 cited data points, 150 institutions, 50 images | The Source Audit tally and `mediaAssets` (card 04) |
| Confirmed, pending or derived | The About section, *How the evidence is graded* |
| CC BY 4.0 | `CONTENT_LICENSE.md` |
| The 1577 ban and the 1581 act | Card 04 and its records |

The caption keeps to what the page says. It does not call the site the first or the largest of
anything, and it does not repeat the "Japan Blue" myth, which has no record in the data.
