# Brief 05: page and content

You build everything that is not WebGL: the HTML, the typography, the words, the clinical annotations, the references, and the versions of the site for phones, reduced motion and no WebGL. You are also responsible for every fact on the page being right.

## You own

- `index.html` (replace the placeholder)
- `src/styles/main.css`
- `src/content/scenes.js`
- `src/scroll/annotations.js`, `src/scroll/progress.js`
- `agents/status/05-page.md`, `agents/shots/05-page/`

The stubs currently in `src/content/` and `src/scroll/` show the exports `src/main.js` expects (CONTRACT section 8). `src/main.js` is the coordinator's; during this phase it is a simple stand-in that renders a placeholder helix, reports scroll progress, fills the readouts and moves one test annotation, so you can see your page working. Shoot it with `npm run shot -- 05-page/<name> "progress=0.3" --page` (and `--size=390x844` for a phone).

## The idea you are serving

**Two-layer copy.** Every scene has one large plain-language line anyone can follow, and a small clinical annotation, pinned to the molecule, for the professional reader. Someone with no science background must be able to scroll the whole site reading only the large lines and get the story. Test that literally.

**Colour is withheld.** The page is monochrome until the payoff. The arterial red appears in the HTML layer only where it echoes the 3D (for example the progress strand's guide thread, or a hairline), never as decoration, and not before the `reader` scene.

## Design system

Colour tokens are in `src/styles/tokens.css` (`--darkfield`, `--deep-field`, `--glass`, `--frost`, `--arterial`). Do not add hues.

**Type**
- Display: **Bodoni Moda** (Google Fonts, variable, with optical size), for the large lines only, at 40px and up. Its hairlines should read like etched glass. Check it in screenshots on the dark background; if the hairlines break up at any size you use, raise the weight or the size rather than leaving it fragile.
- Text: **Instrument Sans**, for body copy, annotations, data and references, with tabular figures for the readouts and data.
- Set a deliberate type scale and stick to it. Line length under about 34 characters for scene copy, under 75 for references.
- Not allowed, because they are the stock look of generated pages: all-caps labels, small "eyebrow" labels above headings, monospace for data, numbered scene markers (01 / 02), middle-dot separators, arrows appended to links, one word of a headline picked out in italic or colour, and fade-and-slide-up entrances.

**Layout**
```
+--------------------------------------------------+
| |                                                |
| |  Twenty letters          \\  //                |
| |  decide.                  \\//   <- helix      |
| |                           //\\                 |
| |  body copy, 2-3 lines    //  \\--- annotation  |
| |                          \\  //    (clinical)  |
| ^ strand progress                                |
+--------------------------------------------------+
```
- Copy is left-aligned in a narrow column in the left third and stays put (sticky) while the scene's scroll length plays out behind it. The 3D owns the centre and right; never cover it.
- Text sits directly on the scene. No cards, panels, boxes or backdrop blur behind scene copy. If legibility needs help, use a soft gradient from the left edge.
- On phones the copy moves to the bottom third over a gradient and the 3D centres.

**Motion**
- Nothing animates by itself. Copy does not fade or slide in; it is simply there when its section arrives, like a page being scrolled. The 3D is the motion.

## Structure (CONTRACT section 8)

`<div id="stage-wrap"><canvas id="stage"></canvas></div>` fixed behind `<main>`. One `<section class="scene" id="scene-<id>" data-scene="<id>">` per scene, in order. Section heights come from `length` in `scenes.js` (in viewport heights). Suggested lengths: title 100, problem 220, spare 320, library 260, reader 260, search 300, match 340, cut 200, repair 260, payoff 320, beyond 220; `practice` and `references` are ordinary content height. The coordinator may retune these numbers later when choreographing.

## Scenes and working copy

The lines are close to final; improve wording where you can make it plainer or more exact, but keep each line short and keep the meaning. Annotations are terse, technical, and attached to a 3D anchor.

| id | Large line | Copy | Annotation (anchor) |
|---|---|---|---|
| `title` | Editing the code | How CRISPR-Cas9 finds one sequence among three billion letters, and what that means for sickle cell disease. | none |
| `problem` | One letter changes the shape of a cell. | In sickle cell disease a single substitution in the beta-globin gene makes hemoglobin stack into rigid fibres when it gives up oxygen. Red cells stiffen, hook and block small vessels. | HBB, A-to-T substitution, Glu6Val; HbS polymerizes on deoxygenation. (`cells.nearCell`) |
| `spare` | You were born with a second hemoglobin. | Fetal hemoglobin does not sickle. Shortly after birth a gene called BCL11A switches it off. Turn that switch back and the spare returns. | BCL11A represses gamma-globin; HbF inhibits HbS polymerization. (`nucleus.clearing`). Also the scale readout, micrometres to nanometres, and the label "chromosome 2". |
| `library` | Three billion letters. One address. | The genome is a text written in four letters. The target here is a stretch of twenty. | About 3.2 billion base pairs per haploid genome. (`helix.top`). Also the base-pair counter readout. |
| `reader` | A protein that can read. | Cas9 is an enzyme that cuts DNA. On its own it is blind. A short strand of guide RNA tells it which twenty letters to look for. | Cas9 ribonucleoprotein, delivered to CD34+ stem cells ex vivo by electroporation. (`cas9.guideTip`) |
| `search` | It checks, and moves on. | Cas9 only stops at a three-letter landmark. It samples site after site, staying a fraction of a second at each. | PAM, 5'-NGG-3'. (`helix.pam`) |
| `match` | Twenty letters decide. | At a landmark the helix is pried open and the guide pairs with the DNA one letter at a time. A mismatch and it lets go. A full match and it locks. | R-loop formation; mismatch tolerance is the basis of off-target editing. (`helix.target`) |
| `cut` | Then it cuts. | Two blades, one for each strand, three letters from the landmark. | HNH cleaves the target strand, RuvC the non-target strand; blunt double-strand break 3 bp upstream of the PAM. (`cas9.hnh`, `cas9.ruvc`) |
| `repair` | The cell repairs it badly. That is the point. | The cell rejoins the ends in a hurry and drops or adds a few letters. Here that small scar lands on the switch that keeps fetal hemoglobin off. | NHEJ indels disrupt the GATA1 binding site in the erythroid-specific enhancer of BCL11A. No repair template; the sickle mutation itself is not corrected. (`helix.cutSite`) |
| `payoff` | The spare comes back on. | Stem cells carrying the edit produce red cells full of fetal hemoglobin. They stay round. | Fetal hemoglobin level and its distribution across red cells, from the pivotal trial. (`cells.source`) |
| `practice` | One infusion, and what it asks of the patient. | See below. | none |
| `beyond` | The next editors do not cut at all. | Base editors change one letter chemically. Prime editors write a short new sequence. Neither needs a double-strand break. | (`helix.editSite`) |
| `references` | References | See below. | none |

### `practice` (ordinary HTML content over slow-drifting red cells)

This is the one place with real data, so it is laid out as content, not as a scene caption. Because red cells are behind it, check contrast carefully; a darkened backdrop for this section is fine.

1. **The treatment as four steps.** This is a true sequence, so numbering it is right: stem cell collection; editing in the lab; myeloablative conditioning; infusion and engraftment. One or two sentences each.
2. **The indication and the evidence**, from the current US prescribing information.
3. **What it asks of the patient**: the label's warnings and the burden of conditioning, stated as plainly as the benefits.

### `references`

Full citations, numbered, linked. The US prescribing information with its revision date; the pivotal sickle cell and beta thalassemia papers; the FDA approval announcements; the Protein Data Bank structure used for the Cas9 model (get the id and citation from `agents/status/02-cas9.md` once that agent has chosen; leave a clearly marked placeholder until then and note it under *Known issues*). End with: this site is educational and non-promotional, is not affiliated with or endorsed by the manufacturers, and its molecular and cellular models are schematic and not to scale.

## Facts: your responsibility

Every clinical or scientific statement must be checked against a primary source that you have actually opened in this session (use WebFetch and WebSearch). **Write nothing clinical from memory**, and do not trust the wording in this brief without checking it.

Already checked by the coordinator, but re-read the label yourself for exact wording:

- DailyMed, Casgevy (exagamglogene autotemcel) label, revised 7/2026: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7c3e12ad-e2fe-4d3f-a630-ea7364d9e846
  - Indicated for patients aged 2 years and older with sickle cell disease with recurrent vaso-occlusive crises, or transfusion-dependent beta thalassemia.
  - Sickle cell disease, ages 12 and over: 29 of 31 (93.5%) free of severe vaso-occlusive crises for at least 12 consecutive months.
  - Beta thalassemia, ages 12 and over: 32 of 35 (91.4%) transfusion independent for at least 12 consecutive months.
  - Ages 5 to under 12: 8 of 8 (sickle cell) and 8 of 9 (thalassemia).
  - Warnings: neutrophil engraftment failure; delayed platelet engraftment; hypersensitivity reactions; off-target genome editing risk.
- FDA, 1 July 2026, extension to ages 2 and over: https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapy-young-children-sickle-cell-disease
- First US approvals: sickle cell disease 8 December 2023; beta thalassemia 16 January 2024.
- Frangoul H, et al. Exagamglogene autotemcel for severe sickle cell disease. *N Engl J Med* 2024;390:1649-62. https://www.nejm.org/doi/full/10.1056/NEJMoa2309676

Still to confirm from a primary source, by you: the fetal hemoglobin figures for the `payoff` annotation; the details of stem cell collection and conditioning; the beta thalassemia pivotal paper's citation; the genome size figure; the Cas9 cut position and which nuclease domain cuts which strand; the HBB mutation nomenclature (use current, correct notation and say which numbering you use). If a published source for the actual exa-cel guide sequence cannot be found, the site must not present any twenty letters as the real target.

In `agents/status/05-page.md`, keep a **Fact table**: each statement on the page, its source URL, and the exact supporting quote. The accuracy reviewer will work from it.

## `scenes.js`, `annotations.js`, `progress.js`

- `scenes.js`: the single source for all copy (the HTML may be generated from it at load, or written statically and kept in sync; generating is safer). Exports per CONTRACT section 8. `formatScale(metres)` returns a short human string such as "6 µm" or "2 nm"; `formatCount(n)` returns a grouped integer such as "3,200,000,000".
- `annotations.js`: each annotation is a small text block joined to its anchor point by a hairline rule, in the manner of a figure label in a journal. `set(id, { x, y, alpha })` receives the anchor's screen position in CSS pixels; you place the label at a sensible offset (keep it on screen, keep it off the copy column) and draw the rule. Use transforms, not layout properties, since it runs every frame.
- `progress.js`: a slim vertical strand at the left edge that unzips as `p` goes from 0 to 1. Small, quiet, precise. It replaces scene numbering.

## Other states

- `html.reduced-motion`: the coordinator shows one still frame per scene; you make sure the page reads well as a sequence of stills (no dependency on sticky scrubbing; shorter sections are fine).
- `html.no-webgl`: no canvas. The page must read as a complete, handsome long-form article on the dark background.
- `html.quality-low` / narrow screens: the phone layout.
- Keyboard: visible focus styles; links reachable; sensible heading order (`h1` for the title, `h2` per scene); the canvas is `aria-hidden`.
- Contrast: body text and annotations meet WCAG AA against the darkest and the lightest thing that can be behind them (including the red cells in `payoff` and `practice`).

## Acceptance criteria

1. Reading only the large lines top to bottom tells the whole story.
2. The typography looks composed and specific to this site at 1440 wide and at 390 wide; nothing from the "not allowed" list appears.
3. Copy never collides with the 3D focal area or with annotations.
4. Every statement in the fact table has a source and a quote.
5. The three fallback states each work and look intentional.

## Rounds

At least four. Shoot the page at several `progress` values on desktop and phone each round and look at them. Final shots in `agents/shots/05-page/final-*.png`: every scene on desktop, at least six on phone, plus reduced-motion and no-WebGL.
