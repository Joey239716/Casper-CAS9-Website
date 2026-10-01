# Decisions

Writer: coordinator. Newest first. Re-read this at the start of every round.

## 2026-10-01 – D-011 The helix arrives and leaves as threads (client request)

- New helix param `presence` (0..1): the strands and rungs thin to nothing. The choreography uses it instead of switching the helix on and off, so it grows from fine threads as the dive arrives and thins away when the camera pulls back (end of the title, start of "payoff"). This also removes the dark far-away helix that showed in front of the cells.
- The framing moves to the "library" side from 72% of "spare", before the helix appears, so it no longer slides across the screen after arriving.

## 2026-10-01 – D-010 More colour after the hemoglobin (client request)

- Same assets, new colours. In `src/scene/nucleus.js` (coordinator edit) every kind of thing has its own hue (`HUE`): indigo envelope, pink pores, amber ribosomes, blue chromatin fibres, pink beads-on-a-string, mint threads, violet haze strands around the helix.
- Cas9's glass is tinted a pale aqua (`CAS9_TINT` in `src/scene/cas9.js`, coordinator edit). The shared glass material is unchanged.
- No geometry, params or anchors changed.

## 2026-10-01 – D-009 A hemoglobin opens "spare"; simpler pores (client request)

- New model `src/scene/hemoglobin.js` (coordinator): one stylised tetramer, four lobes each with a red heme disc, and a far crowd of simple copies. Params `presence`, `fetal` (the two violet beta lobes turn teal gamma), `spin`. Anchors `fetal`, `heme`. It rides on the camera like the cells.
- "Spare" now runs: hemoglobin (scene progress 0 to 0.26, `HEMO_END` in `timeline.js`), then the dive (0.26 to 0.86). The scale readout is hidden until the dive starts.
- New annotation `spare-hbf` (HbF is two alpha and two gamma chains; HbA has beta in their place). It has no reference yet and is not in the fact table: needs a source before release.
- Nuclear pores are simplified in `src/scene/nucleus.js` (coordinator edit to 04's file): the cytoplasmic filaments and the nuclear basket are removed, the eight swellings are lower.
- The client asked for more colour here: blue (alpha), violet (beta), teal (gamma), red (heme).

## 2026-10-01 – D-008 Codons and a coloured title word (client request)

- The drifting genetic text is now codons, not single letters: sixteen triplets from the opening of the HBB coding sequence (including GAG and GTG), each letter in its base colour. `src/scene/letters.js`; params unchanged.
- One word of the title ("code") is set in a gradient of the helix's colours. The word is `accent` on the title scene in `src/content/scenes.js`; the colours are new tokens in `src/styles/tokens.css`. The coordinator edited 05-page's files for this.

## 2026-10-01 – D-007 Ribbon helix and the title hook (client request)

- The helix is no longer beaded. Each backbone is a smooth lilac tube; rungs are round rods, split into their two base colours. Changed in `src/scene/helix.js` by the coordinator; every existing param, anchor and site is unchanged.
- Only every second rung is drawn (a stylisation the client chose). The hidden ones grow in wherever one glows or a bubble is open, so PAM flashes still show 3 rungs and the match still lights 20.
- New helix params: `hook` (0..1) bends the axis into a "tsu" shaped hook around base pair 195, in a plane facing the camera at `hookAzimuth`. New anchor `hook`. The title uses it to wrap the helix around "Editing the code"; it straightens as the title scrolls away.
- The title also shows the drifting letters and a soft violet glow behind the helix (`src/scene/halo.js`, coordinator).
- The title weave overlay (`src/scene/weave.js`) is removed: the helix now goes around the title, not through it.

## 2026-10-01 – D-006 Colour and a beaded helix (client request)

- The site is no longer monochrome. The helix is a beaded, space-filling style model: lilac-pink backbones, rungs in pastel base colours (A yellow, T blue, C coral, G mint).
- The accent is now gold, not red: guide RNA, PAM flashes, matched rungs, the Cas9 cut flare and the progress strand. Red stays for the red cells only.
- Background is a violet-to-navy gradient; haze is lilac; drifting letters take their base's colour.
- The helix axis sways slowly (param `sway`), straightened while Cas9 is docked.

## 2026-10-01 – D-005 Desktop only

- The client only cares about the desktop view. Phone layout, reduced motion and no-WebGL are no longer checked or fixed.

## 2026-10-01 – D-004 Answers to 05-page

- R-05-1: done. The base-pair counter ends at 3,055,000,000.
- R-05-2: the `spare-chr2` annotation is removed; no chromosome anchor exists.
- R-05-3: done. In reduced motion each scene's annotations show on its still frame.
- R-05-4: the scale bar stays.
- Reference 21 (PDB 5F9R) confirmed by 02-cas9; the provisional marker is removed.
- Annotation labels now have a soft dark backing so they read over bright glass.
- Agent 07 (accuracy review) is reinstated, time-boxed.

## 2026-10-01 15:55 – D-003 Answers to 02-cas9

- R-02-1: accepted. Cas9 keeps its own glass clone with environment refraction; the shared glass is unchanged.
- R-02-2: the shared `guide` material now uses a purer, less bright red emissive so it stays red after tone mapping.
- Cas9's frame cost (about 8 ms measured by the agent, against a 3 ms budget) is not addressed; it is recorded as a known issue.

## 2026-10-01 15:40 – D-002 Answers to 03-cells

- R-03-1: accepted. Clear cells stay as a blended shell rather than the shared transmissive glass.
- R-03-2: the shared glass keeps `dispersion: 4`; instead the renderer's pixel ratio is capped at 1.5 (1.25 on phones) in `src/scene/context.js`.
- R-03-3: no change to the shared `arterial` material.
- Choreography now keeps `flow` between -25 and +12 through the opening and nearly still during `replace`.

## 2026-10-01 15:16 – D-001 Wrap up now (client is short on time)

- All builders: finish the round you are in, leave your files working, and stop. The five-round minimum no longer applies.
- Before stopping, make *Interface delivered* in your status file exact, list *Known issues*, and set `Status: done`.
- Ownership change: `src/scene/letters.js` and `src/scene/post.js` move from 04-atmosphere to the coordinator. 04-atmosphere finishes `nucleus.js` only.
- The two review agents (06, 07) are cancelled; the coordinator does one review pass.

## 2026-10-01 14:40 – D-000 Foundation in place

- The dev server is running on http://localhost:5173. The lab and `npm run shot` work.
- Shared glass, frost, arterial and guide materials are in `src/scene/materials.js`; lighting is in `src/scene/environment.js`.
- Every file in `src/scene/` that belongs to an agent currently holds a placeholder. Replace yours.
- No requests answered yet.
