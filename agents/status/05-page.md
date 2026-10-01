# Status: 05-page

Status: done
Round: 4
Updated: 2026-10-01 15:30

## Summary
The page layer is complete and loads without console errors against the coordinator's current `src/main.js`: shell HTML, stylesheet, all copy and clinical annotations, pinned annotation labels, progress strand, the practice and references sections, and the phone, reduced-motion and no-WebGL states. Every clinical statement on the page is in the fact table below with a source opened in this session; statements that could not be verified were removed or softened (listed under Known issues). Stopped at round 4 under D-001; the last screenshots show legibility problems for annotation labels over bright glass that I did not get to fix (see Known issues).

## Interface delivered

### Files
- `index.html`: shell only. All words are built into `<main id="main">` at load.
- `src/content/scenes.js`: single source of all copy.
- `src/content/page.render.js`: private helper (mine). Builds `<main>` from `scenes.js`. It is loaded by `index.html` as a module script placed before `/src/main.js`, so every section and readout element exists before `main.js` queries the DOM. Do not reorder those two script tags.
- `src/styles/main.css`, `src/scroll/annotations.js`, `src/scroll/progress.js`.
- `agents/shots/05-page/_shot.mjs`: private screenshot helper (clip, device scale, `--scene=id:fraction`). Not part of the site.

### DOM hooks (all present after `page.render.js` runs)
- `<div id="stage-wrap"><canvas id="stage" aria-hidden="true"></canvas></div>`: fixed, full viewport, z-index 0.
- `<div class="scrim">`: fixed legibility gradient (left on desktop, bottom on phones), z-index 1.
- `<div data-annotations aria-hidden="true">`: fixed, full viewport, `pointer-events: none`, z-index 2.
- `<main id="main">`: z-index 3.
- `<div data-progress aria-hidden="true">`: fixed strand at the left edge, z-index 4.
- One `<section class="scene" id="scene-<id>" data-scene="<id>">` per scene, in contract order. Eleven are pinned (`.scene--pinned`, height `calc(var(--len) * 1vh)`, with `--len` set inline from `length`); `practice` and `references` are `.scene--content` at natural height.
- `[data-readout="scale"]` lives in `#scene-spare`; `[data-readout="count"]` lives in `#scene-library`. `main.js` sets `textContent`.
- `data-scene` is used only on the `<section>` elements. Annotation elements carry `data-annotation="<id>"` and `data-annotation-scene="<scene>"`.
- Headings: `h1` in `title`, `h2` in every other scene, `h3`/`h4` inside `practice`.
- `html.no-webgl`: stage, scrim and annotation layer are hidden; sections collapse to article rows; the clinical notes appear inline beside each passage; readouts are hidden.
- `html.reduced-motion`: pinned sections become `min-height: 100svh`, copy is not sticky.
- Phone layout is a media query, `max-width: 900px` (not tied to `html.quality-low`): copy in the bottom of the viewport over a bottom gradient.

### `src/content/scenes.js`
- `scenes`: array in contract order, each `{ id, line, copy, length, annotations, readout? }`.
- Lengths (viewport heights): title 100, problem 220, spare 320, library 260, reader 260, search 300, match 340, cut 200, repair 260, payoff 320, practice `null`, beyond 220, references `null`. The coordinator can retune them here; nothing else needs to change.
- `annotations[]`: `{ id, anchor, text, term?, refs? }`. `text` is the complete label. `term` is the leading substring of `text` to set in a heavier weight. `refs` are keys into `references`.
- `formatScale(metres)` returns e.g. `"6 µm"`, `"430 nm"`, `"2 nm"` (no-break space; one decimal under 10, integers to 100, nearest 10 above).
- `formatCount(n)` returns a grouped integer, e.g. `"3,055,000,000"`.
- Also exported for the page layer: `practice`, `references`, `closingNote`, `approvals`, `refNumber(key)`.

### Annotations (id, anchor)
| id | anchor | scene |
|---|---|---|
| `problem-hbb` | `cells.nearCell` | problem |
| `spare-switch` | `nucleus.clearing` | spare |
| `spare-chr2` | `nucleus.chromosome2` | spare |
| `library-genome` | `helix.top` | library |
| `reader-rnp` | `cas9.guideTip` | reader |
| `search-pam` | `helix.pam` | search |
| `match-rloop` | `helix.target` | match |
| `cut-hnh` | `cas9.hnh` | cut |
| `cut-ruvc` | `cas9.ruvc` | cut |
| `repair-nhej` | `helix.cutSite` | repair |
| `payoff-hbf` | `cells.source` | payoff |
| `beyond-editors` | `helix.editSite` | beyond |

`nucleus.chromosome2` is an anchor name I invented for the "chromosome 2" label; see R-05-2.

### `src/scroll/annotations.js`
`createAnnotations({ root, defs })` returns `{ set(id, { x, y, alpha }), hideAll() }`.
- `x`, `y`: anchor in CSS pixels from the viewport's top-left. `alpha` 0 to 1; 0.01 or less hides.
- Draws a ring at the anchor, a hairline leader, and a text block under a hairline rule. Writes only `transform`, `opacity`, `visibility`, and only on change.
- Placement: up and to the right of the anchor (84 px across, 52 px up on desktop); flips left near the right edge; never left of 42% of the viewport width on desktop (clear of the copy column); on phones stays between y = 56 px and 52% of the viewport height. Labels visible at the same time are pushed apart.
- An anchor more than 40 px outside the viewport hides its label.

### `src/scroll/progress.js`
`createProgress(el)` returns `{ set(p) }`, `p` 0 to 1 over the whole page. Draws an SVG strand that unzips from the top down to `p`. Ticks mark where each section starts. A red thread (the only arterial red in the HTML layer) appears in the opened part from the point where `#scene-reader` begins.

## Fact table

Sources were opened in this session. "Label" is the Casgevy US prescribing information on DailyMed, revised 7/2026: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7c3e12ad-e2fe-4d3f-a630-ea7364d9e846 (full text downloaded and read; quotes are verbatim). PubMed abstracts were retrieved through the NCBI E-utilities; PMC full texts through the same service.

| # | Where | Statement on the page | Source | Supporting quote |
|---|---|---|---|---|
| 1 | problem, annotation | HBB c.20A>T, p.Glu7Val in HGVS numbering; Glu6Val in the legacy numbering | ClinVar VCV000015333, https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/ | Record title: "NM_000518.5(HBB):c.20A>T (p.Glu7Val)"; submitter comment in the record: "Glu6Val or HbS (HbVar ID 226), variant has been reported in many individuals affected by sickle cell disease"; other names in the record include "GLU6VAL" and "E6V". Papizan 2020 also writes "(c.20A>T; p.Glu6Val)" |
| 2 | problem, copy and annotation | A single substitution in the beta-globin gene; deoxygenated HbS polymerizes into fibers; cells sickle and block small vessels | Papizan 2020, J Biomed Res, PMC8038529, https://doi.org/10.7555/JBR.34.20200096 | "a substitution in the sixth amino acid of the β-globin subunit causes a structural aberration (HbS) that leads to polymerization of tetramers upon deoxygenation. These tetramers then align to form rod-like fibers that cause the deformation of the red blood cells into the characteristic sickle shape"; "sickled RBCs either lyse ... or occlude small blood vessels" |
| 3 | problem, copy | Red cells stiffen | Eaton and Bunn 2017, Blood, PMID 28385699; NHLBI, https://www.nhlbi.nih.gov/health/sickle-cell-disease/causes | "polymerization of hemoglobin S (HbS) to form fibers that make red cells less flexible"; "Hemoglobin S changes flexible red blood cells into rigid, sickle-shaped cells. The sickled cells can block blood flow" |
| 4 | spare, copy and annotation | Fetal hemoglobin keeps red cells from sickling; HbF lowers intracellular HbS concentration | Label, 12.1 | "HbF expression reduces intracellular hemoglobin S (HbS) concentration, preventing the red blood cells from sickling" |
| 5 | spare, copy | Around the time of birth fetal hemoglobin is switched off | Papizan 2020 | "The expression of HBG1 and HBG2 becomes repressed around the time of birth, and the expression of HBB is turned on" |
| 6 | spare, copy and annotation | BCL11A represses gamma-globin and fetal hemoglobin | Frangoul 2021, NEJM, PMID 33283989, https://doi.org/10.1056/NEJMoa2031054 | "BCL11A is a transcription factor that represses γ-globin expression and fetal hemoglobin in erythroid cells." |
| 7 | spare, annotation | BCL11A sits on chromosome 2 at 2p16.1 | NCBI Gene 53335 (E-utilities summary), https://www.ncbi.nlm.nih.gov/gene/53335 | name "BCL11A", description "BCL11 transcription factor A", maplocation "2p16.1", chromosome "2" |
| 8 | library, line and annotation | Three billion letters; 3.055 billion base pairs in the first complete human genome sequence, T2T-CHM13 | Nurk 2022, Science, PMID 35357919 | "presents a complete 3.055 billion-base pair sequence of a human genome, T2T-CHM13" |
| 9 | library and reader, copy | The target is a stretch of twenty letters | Knight 2015, Science, PMID 26564855 | "recognize and cleave double-stranded DNA sequences on the basis of 20-nucleotide RNA-DNA complementarity" |
| 10 | reader, copy | Cas9 cuts DNA and is directed by a guide RNA | Jinek 2012, Science, PMID 22745249 | "forms a two-RNA structure that directs the CRISPR-associated protein Cas9 to introduce double-stranded (ds) breaks in target DNA" |
| 11 | reader, copy | On its own it is blind | Sternberg 2014, Nature, PMC4106473 | "apo-Cas9 also bound DNA but exhibited no apparent sequence specificity" |
| 12 | reader, annotation | For exa-cel the ribonucleoprotein is delivered to the patient's own CD34+ cells outside the body by electroporation | Label, 11 | "The autologous cells are enriched for CD34+ cells, and then genome edited ex vivo by introducing the CRISPR/Cas9 ribonucleoprotein (RNP) complex by electroporation." |
| 13 | search, copy and annotation | Cas9 only stops at a three-letter landmark; without the PAM a matching sequence is ignored | Sternberg 2014, PMID 24476820 | "both binding and cleavage of DNA by Cas9-RNA require recognition of a short trinucleotide protospacer adjacent motif (PAM)"; "sequences fully complementary to the guide RNA but lacking a nearby PAM are ignored by Cas9-RNA" |
| 14 | search, annotation | PAM is 5'-NGG-3' for Streptococcus pyogenes Cas9 | Sternberg 2014, PMC4106473 | "PAMs (5'-NGG-3' for S. pyogenes Cas9)" |
| 15 | search, copy and annotation | Less than a second at each wrong site; under 1 second on average in living cells | Knight 2015 | "off-target binding events are, on average, short-lived (<1 second)" |
| 16 | match, copy and annotation | The helix opens beside the PAM and the guide pairs directionally away from it | Sternberg 2014 | "DNA strand separation and RNA-DNA heteroduplex formation initiate at the PAM and proceed directionally towards the distal end of the target sequence" |
| 17 | match, copy | An early mismatch and it lets go | Sternberg 2014, PMC4106473 | "mismatches encountered early in a directional melting-in process would prematurely abort target interrogation" |
| 18 | match, copy | A full match and it locks | Sternberg 2014, PMC4106473 | "The DNA is cleaved and Cas9:RNA remains bound to the cleaved products." |
| 19 | match, annotation | Cas9 tolerates some mismatches depending on number and position; basis of off-target editing | Hsu 2013, Nat Biotechnol, PMID 23873081 | "SpCas9 tolerates mismatches between guide RNA and target DNA at different positions in a sequence-dependent manner, sensitive to the number, position and distribution of mismatches" |
| 20 | cut, annotations | HNH cleaves the target strand (paired with the guide), RuvC the non-target strand | Jinek 2012 | "the Cas9 HNH nuclease domain cleaves the complementary strand, whereas the Cas9 RuvC-like domain cleaves the noncomplementary strand" |
| 21 | cut, copy and annotation | Double-strand break 3 bp upstream of the PAM | Jiang 2016, Science, PMC5111852, https://doi.org/10.1126/science.aad8282 | "leading to double-stranded DNA (dsDNA) cleavage 3 base pairs (bp) upstream of the PAM via the HNH and RuvC nuclease domains" |
| 22 | repair, copy and annotation | The cell rejoins the ends and drops or adds a few letters (NHEJ indels) | Canver 2015, Nature, PMC4644101 | "the typical outcome of Cas9 cleavage and NHEJ repair, an indel spectrum with frequent deletions of up to 10 bp from the cleavage position" |
| 23 | repair, annotation | In exa-cel the indels disrupt a GATA1 binding site in the erythroid-specific enhancer of BCL11A | Label, 11; Papizan 2020 | "make a precise DNA double-strand break at a critical transcription factor binding site (GATA1) in the erythroid specific enhancer region of the BCL11A gene. As a result of the editing, GATA1 binding is disrupted and BCL11A expression is reduced."; "CTX001 is a therapeutic CRISPR-Cas9 RNP complex that creates indels at the GATA1/TAL1 binding sites in the BCL11A erythroid specific enhancer" |
| 24 | repair, annotation | The edit is in BCL11A, not HBB; the sickle variant is unchanged | Label, 11 (inference) | Inference from the label's description of the only edit made (quote in row 23); the label describes no change to HBB. |
| 25 | payoff, copy | Edited stem cells produce red cells rich in fetal hemoglobin, which do not sickle | Label, 12.1 | "the edited CD34+ cells engraft in the bone marrow and differentiate to erythroid lineage cells with reduced BCL11A expression. Reduced BCL11A expression results in an increase in γ-globin expression and HbF protein production" |
| 26 | payoff, annotation | Pivotal trial, age 12 and over, month 6: HbF a mean 43.9% of hemoglobin; 94.0% of circulating red cells contained HbF | Label, 12.2 | "The mean (SD) proportion of Hb comprised by HbF was 43.9% (8.6%) at Month 6"; "the mean (SD) proportion of circulating erythrocytes expressing HbF (F-cells) at Month 3 was 70.1% (13.8%) and continued to increase over time to 94.0% (12.4%) at Month 6" |
| 27 | beyond, copy and annotation | Base editors convert C to T (or G to A) with a deaminase fused to Cas9, without a double-strand break | Komor 2016, Nature, PMID 27096365 | "We engineered fusions of CRISPR/Cas9 and a cytidine deaminase enzyme that ... do not induce dsDNA breaks, and mediate the direct conversion of cytidine to uridine, thereby effecting a C→T (or G→A) substitution" |
| 28 | beyond, copy and annotation | Prime editors write a new sequence using an impaired Cas9 fused to a reverse transcriptase and a pegRNA, without double-strand breaks | Anzalone 2019, Nature, PMID 31634902 | "directly writes new genetic information into a specified DNA site using a catalytically impaired Cas9 endonuclease fused to an engineered reverse transcriptase, programmed with a prime editing guide RNA (pegRNA) ... without requiring double-strand breaks or donor DNA templates" |
| 29 | practice, intro | Patient's own stem cells; a single dose | Label, 2.1 and 11 | "For autologous use only. For one-time, single dose intravenous use only."; "CASGEVY is prepared from the patient's own HSCs" |
| 30 | practice, step 1 | In sickle cell disease: at least 8 weeks of transfusions, plerixafor, apheresis | Label, 2.2 | "it is recommended to transfuse red blood cells (RBCs) (simple or exchange) as needed, for a minimum of 8 weeks"; "Sickle Cell Disease: Administer plerixafor 0.24 mg/kg/day via subcutaneous injection 2 to 3 hours prior to planned apheresis" |
| 31 | practice, step 1 | Median 2 cycles, up to 6, in the pivotal sickle cell trial | Label, 14.1 | "The mean (SD) and median (min, max) number of mobilization and apheresis cycles required for the manufacture of CASGEVY and for the back-up collection of rescue CD34+ cells were 2.3 (1.41) and 2 (1, 6), respectively." |
| 32 | practice, step 1 | A back-up of unedited cells is stored | Label, 2.2 | "Collect and cryopreserve an additional ≥ 2 × 10^6 CD34+ cells/kg of unmodified back-up rescue cells prior to myeloablative conditioning" |
| 33 | practice, step 2 | Cells frozen and shipped; manufacturing may take up to 6 months | Label, 11 and Patient Information | "CASGEVY is shipped as a frozen suspension in patient-specific vial(s)."; "Manufacturing may take up to 6 months." |
| 34 | practice, step 3 | Full myeloablative conditioning; busulfan in the trials; central vein, 4 consecutive days; infusion 48 hours to 7 days after | Label, 2.2 and 14.1 | "If busulfan is used for myeloablative conditioning, administer intravenously (IV) for 4 consecutive days via a central venous catheter."; "Administer CASGEVY between 48 hours and 7 days after the last dose of the myeloablative conditioning regimen."; "myeloablative conditioning with busulfan prior to treatment with CASGEVY" |
| 35 | practice, step 4 | Minimum dose 3 × 10^6 CD34+ cells per kg | Label, 2.1 | "The minimum recommended dose of CASGEVY is 3 × 10^6 CD34+ cells/kg." |
| 36 | practice, step 4 | Hospital stay about 4 to 6 weeks, times vary | Label, Patient Information | "After the CASGEVY infusion, you will stay in hospital ... This can take 4-6 weeks, but times can vary." |
| 37 | practice, indication | Patients aged 2 years and older with SCD with recurrent VOCs, or TDT | Label, 1 | "CASGEVY is indicated for the treatment of patients aged 2 years and older with: sickle cell disease (SCD) with recurrent vaso-occlusive crises; transfusion-dependent β-thalassemia (TDT)" |
| 38 | practice, approvals | First approved for SCD on 8 December 2023, ages 12 and over | FDA, https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease | Dated December 08, 2023. "Casgevy, a cell-based gene therapy, is approved for the treatment of sickle cell disease in patients 12 years of age and older with recurrent vaso-occlusive crises." |
| 39 | practice, approvals | Approved for TDT on 16 January 2024, ages 12 and over | FDA, https://www.fda.gov/news-events/press-announcements/fda-roundup-january-16-2024 | "Today, the FDA approved Casgevy, a cell-based gene therapy, for the treatment of patients 12 years of age and older with transfusion-dependent beta-thalassemia" |
| 40 | practice, approvals | Extended to ages 2 and over on 1 July 2026 | FDA, https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapy-young-children-sickle-cell-disease | Dated July 01, 2026. "Casgevy (exagamglogene autotemcel) for patients aged 2 years and older with either sickle cell disease (SCD) with recurrent vaso-occlusive crises (VOCs) or transfusion-dependent β thalassemia (TDT)." |
| 41 | practice, table | SCD 12 and over: 29 of 31 (93.5%) free of severe VOC for at least 12 consecutive months; 30 of 30 free of hospitalization | Label, 14.1 | "the primary efficacy outcome of VF12 response was achieved in 29 of 31 (93.5%, 98% one sided CI: 77.9%, 100.0%) patients"; "All 30 (100%, ...) evaluable patients achieved the secondary endpoint of HF12." |
| 42 | practice, table | SCD 5 to under 12: 8 of 8 | Label, 14.1 | "the primary efficacy outcome of VF12 was achieved in all 8 patients (100%)" |
| 43 | practice, table | TDT 12 and over: 32 of 35 (91.4%) transfusion independent for at least 12 consecutive months | Label, 14.2 | "the primary efficacy outcome of TI12 was achieved in 32 of 35 (91.4%, 98.3% one sided CI: 75.7%, 100%) patients" |
| 44 | practice, table | TDT 5 to under 12: 8 of 9 (89%) | Label, 14.2 | "Of the 9 efficacy evaluable patients, including one who died prior to Month 16, 8 (89%) patients achieved the primary efficacy outcome of TI12." |
| 45 | practice, notes | Open-label single-arm trials; 24 months of follow-up; long-term follow-up to 15 years | Label, 14.1 | "two multicenter, open-label, single arm trials"; "Patients were then followed for 24 months after CASGEVY infusion. Patients from Trial 1 or Trial 4 are eligible to enroll in an ongoing trial for long-term follow up for a total of 15 years" |
| 46 | practice, notes | Not studied under age 5; ages 2 to under 5 by extrapolation | Label, 8.4 | "CASGEVY has not been studied in patients less than 5 years of age in clinical trials. The use of CASGEVY in pediatric patients aged 2 years to less than 5 years of age with SCD is supported by extrapolation of data" |
| 47 | practice, notes | The published sickle cell paper reports 29 of 30 | Frangoul 2024, NEJM, PMID 38661449 | "Of the 30 patients who had sufficient follow-up to be evaluated, 29 (97%; 95% confidence interval [CI], 83 to 100) were free from vaso-occlusive crises for at least 12 consecutive months" |
| 48 | practice, asks | Hydroxyurea and crizanlizumab stopped 8 weeks before; HbS below 30% | Label, 2.2 | "Discontinue disease modifying therapies (e.g., hydroxyurea, crizanlizumab) 8 weeks before the planned start of mobilization and conditioning"; "with a goal to maintain hemoglobin S (HbS) levels < 30% of total hemoglobin" |
| 49 | practice, asks | 6 patients (10%) could not be treated because of inadequate cell collection | Label, 14.1 | "Six (10%) patients were unable to receive CASGEVY therapy due to inadequate cell collection." |
| 50 | practice, asks | All patients had grade 3 or 4 neutropenia and thrombocytopenia; mucositis and febrile neutropenia most common severe reactions | Label, 6.1 | "All (100%) of the patients with TDT and SCD experienced Grade 3 or 4 neutropenia and thrombocytopenia."; "The most common Grade 3 or 4 non-laboratory adverse reactions (occurring in ≥ 25%) were mucositis and febrile neutropenia in patients with SCD and patients with TDT" |
| 51 | practice, asks | Infertility observed with myeloablative conditioning; discuss fertility preservation | Label, 8.3 | "Infertility has been observed with myeloablative conditioning therefore, advise patients of fertility preservation options before treatment, if appropriate." |
| 52 | practice, asks | Two deaths in the trials | Label, 6.1 | "One (2%) patient died due to a COVID-19 infection and subsequent respiratory failure. The event was not related to CASGEVY."; "One patient who received busulfan conditioning and CASGEVY developed veno-occlusive disease (VOD) and hemophagocytic lymphohistiocytosis (HLH) and died due to pneumonia and subsequent multi-organ failure" (Trial 5, ages 5 to under 12) |
| 53 | practice, asks | No donating blood, organs, tissues or cells afterwards | Label, 17 | "Advise patients that they should not donate blood, organs, tissues, or cells at any time in the future." |
| 54 | practice, warnings | Neutrophil engraftment failure: potential risk; none in trials; medians 26 to 31 days; back-up cells are the rescue | Label, 5.1 and 6.1 | "There is potential risk of neutrophil engraftment failure ... In the clinical trials, all treated patients achieved neutrophil engraftment and no patients received rescue CD34+ cells."; Tables 5 and 9 medians: 28, 29, 26 (SCD) and 30, 31, 29 (TDT) days |
| 55 | practice, warnings | Delayed platelet engraftment; medians 32.5 to 51 days; bleeding risk | Label, 5.2 and 6.1 | "Delayed platelet engraftment has been observed with CASGEVY treatment. There is an increased risk of bleeding until platelet engraftment is achieved"; Tables 4 and 8 medians: 47, 40, 32.5 (SCD) and 51, 46, 40 (TDT) days |
| 56 | practice, warnings | Hypersensitivity including anaphylaxis from DMSO or dextran 40 | Label, 5.3 | "Hypersensitivity reactions, including anaphylaxis, can occur due to dimethyl sulfoxide (DMSO) or dextran 40 in the cryopreservation solution." |
| 57 | practice, warnings | Off-target editing cannot be ruled out; clinical significance unknown | Label, 5.4 | "The risk of unintended, off-target editing in an individual's CD34+ cells cannot be ruled out due to genetic variants. The clinical significance of potential off-target editing is unknown." |
| 58 | references | Pivotal papers' citations | PubMed 38661449, 38657265 | "N Engl J Med. 2024 May 9;390(18):1649-1662. doi: 10.1056/NEJMoa2309676"; "N Engl J Med. 2024 May 9;390(18):1663-1676. doi: 10.1056/NEJMoa2309673" |
| 59 | references | PDB 5F9R (provisional) | RCSB, https://www.rcsb.org/structure/5F9R | Entry title: "Crystal structure of catalytically-active Streptococcus pyogenes CRISPR-Cas9 in complex with single-guided RNA and double-stranded DNA primed for target DNA cleavage"; primary citation Science 2016;351:867 |

## Copy changed from the brief, and why
- `problem`: "fibres" to "fibers", "hook" to "bend into sickles" (US spelling throughout; plainer). Annotation uses HGVS notation `c.20A>T, p.Glu7Val` and names the legacy `Glu6Val`.
- `spare`: "Fetal hemoglobin does not sickle" to "keeps red cells from sickling"; "Shortly after birth" to "Around the time of birth". Both to match what the sources say. The annotation's "HbF inhibits HbS polymerization" became the label's wording (lowers intracellular HbS concentration, prevents sickling) because I did not open a primary source for the polymerization-inhibition mechanism.
- `library`: annotation is 3.055 billion base pairs (T2T-CHM13), not "about 3.2 billion".
- `search`: "a fraction of a second at each" to "less than a second at each wrong one" (the source says under 1 second, for off-target sites, in living mammalian cells).
- `match`: "At a landmark" to "Beside a landmark"; "A mismatch and it lets go" to "An early mismatch and it lets go" (Cas9 tolerates some mismatches; the annotation says so).
- `cut`: "blunt" removed from the annotation (no opened source for it).
- `repair`: "No repair template" removed; kept "the sickle variant itself is left unchanged", marked as an inference in the fact table.
- `payoff`: "full of fetal hemoglobin" to "rich in" (HbF was about 44% of hemoglobin). Annotation carries the actual figures.
- `beyond`: line changed from "The next editors do not cut at all" to "The next editors do not cut the helix in two" (base and prime editors still nick one strand).

## Iteration log
### Round 4
- Changed: phone breakpoint raised to 900 px; copy column minimum width; stronger scrim; favicon; collection step made sickle-cell-specific; hospital stay softened to match the patient information; structure reference filled provisionally (5F9R).
- Screenshots: `agents/shots/05-page/final-*.png` (31 files) and `r4-*.png`.
- Critique: with the coordinator's real engine in place, `final-check.png` (match) shows the annotation label lying over bright Cas9 glass, where 13 px text is hard to read. Not fixed. In `final-reduced.png` no annotation is drawn at all.

### Round 3
- Changed: fixed a bug where annotation elements carried `data-scene` and could be matched instead of the sections; copy column widened; leaders lengthened; phone evidence table fixed.
- Screenshots: `r3-*.png`, including `r3-payoff-redtest.png`, `r3-ph-payoff-redtest.png`, `r3-practice-redtest.png` (a simulated full-red backdrop to test contrast).
- Critique: copy and labels held up over solid arterial red. "The cell repairs it badly." broke awkwardly in the narrower column.

### Round 2
- Changed: Bodoni Moda hairlines broke up at 1x on the dark field at 63 px. Compared four settings (`r2-bodoni-A..D.png`) and chose optical size 20 with tighter tracking for scene lines; the title keeps optical size 96. Shot phone, no-WebGL and reduced-motion.
- Screenshots: `r2-*.png`.
- Critique: phone evidence table header cell kept its desktop width; title lede too close to the title.

### Round 1
- Changed: first full build of all files.
- Screenshots: `r1-*.png`.
- Critique: hairlines of the scene lines fragile at 1x; "3 × 10⁶" broke across lines.

## Requests
- R-05-1 (open): `main.js` counts the `library` readout to 3.2e9. The sourced figure on the page is 3.055 billion (T2T-CHM13). Please end the counter at 3.055e9 so the readout and the annotation agree.
- R-05-2 (open): the "chromosome 2" label is annotation `spare-chr2` with anchor `nucleus.chromosome2`, a name I made up. Please map it to a real anchor, or tell me the name to use.
- R-05-3 (open): in reduced-motion mode please still call `annotations.set()` for the still frame's anchors; otherwise the clinical notes are not visible in that mode (they are only shown inline under `html.no-webgl`).
- R-05-4 (open): the scale readout is captioned "approximate scale of the view" and drawn beside a fixed 120 px scale bar. If the readout is not meant as the length that bar represents, tell me and I will drop the bar.

## Known issues
- Annotation labels have no backing, only a text shadow. Over bright glass (seen in `match` with the real Cas9) they are hard to read. Not checked for WCAG AA against the real models; only against a simulated solid red backdrop.
- Of the 31 `final-*` screenshots, taken against the coordinator's real engine, I opened only three: `final-check.png` (match), `final-reduced.png` and `final-practice-1.png`. The rest were not looked at. All earlier rounds were judged against the stand-in helix.
- Structure reference: `agents/status/02-cas9.md` had no structure recorded. Reference 21 names PDB 5F9R, taken from `scripts/build-cas9.mjs` and checked against the RCSB record, and is marked "Provisional" on the page and `pending: true` in `scenes.js`. Remove the marker once confirmed.
- Not verified, so not on the page: that Cas9 leaves blunt ends; that HbF inhibits HbS polymerization directly; the exa-cel guide sequence. I found no opened source for the actual twenty-letter target, so the site must not present any twenty letters as the real one.
- NEJM full texts returned HTTP 403; the three NEJM papers are cited from their PubMed abstracts only. The label figure (29 of 31) and the paper's (29 of 30) differ and the page says so.
- Fact-table row 24 is an inference, not a quoted statement.
- `search` annotation gives the PAM for S. pyogenes Cas9 in general; I did not verify from a primary source which Cas9 exa-cel uses (5F9R is S. pyogenes, but that is the model, not the product).
- The page needs JavaScript: without it only a `<noscript>` line is shown.
- Fonts load from Google Fonts; offline, the fallbacks in `tokens.css` apply.
- Anchor links (skip links, citation numbers to references) were not tested with Lenis running.
- Phone layout applies up to 900 px wide, so portrait tablets get it too; not reviewed beyond one screenshot (`r4-tablet.png`).
