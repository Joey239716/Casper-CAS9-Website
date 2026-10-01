# Status: 03-cells

Status: done
Round: 6
Updated: 2026-10-01 15:22

## Summary
`src/scene/cells.js` (plus the private helper `src/scene/cells.shapes.js`) is in place and loads in the lab with no console errors at both qualities. Both shapes, all five params, the three anchors and the three views are delivered; the final screenshot set is in `agents/shots/03-cells/final-*.png`. Stopped at D-001: the look is good but two things are not what the contract assumed (the clear cells do not use the shared transmissive glass, and the 4 ms budget is not confirmed). See Requests and Known issues.

## Interface delivered

### Layout (local space, 1 unit = 1 micrometre, built for group scale 1 and fog 0.012)
- The stream runs along local **+Z**, from the source at **z = -96** to the near end at **z = +34**. Wrap length **130**.
- Cross-section at the near end: **x -43..+43, y -27.5..+27.5**. Towards the far end it widens by 30 % and the centreline bends to (+8, +5), so the far end spans roughly x -48..+64, y -31..+41.
- **Camera: on the local Z axis (x = y = 0, keep within about 2 units of it), z between 0 and 26, looking towards -Z.** The `hero` view is pos (0, 0, 20), look (2, 1, -40), fov 35. From there 116 units of field lie ahead and 14 behind.
- Cells part around that axis as they arrive: for z >= -6 no cell centre comes closer than 7.3 units to the Z axis (cell radius 3.9), so nothing clips the camera. The parting ramps in between z = -32 and z = -6. A camera anywhere else inside the volume will have cells pass through it.
- Counts: 150 clear slots and 480 red slots on `high`; 76 and 220 on `low`. At most about 480 cells are drawn at once.

### Params (`model.params`)
| Param | Range | Default | Effect |
|---|---|---|---|
| `flow` | any number | 0 | Moves every cell towards the viewer by this many micrometres. Periodic: `flow` and `flow + 130` give the same picture. |
| `sickled` | 0..1 | 0.45 | Fraction of clear slots drawn as sickle cells. Each slot switches shape within +-0.012 of its own threshold (a quick scale swap, not a morph). |
| `replace` | 0..1 | 0 | The payoff. Moves a front along the stream at stream coordinate 0 / 30 / 56 / 130 / 178 for replace 0 / 0.25 / 0.5 / 0.85 / 1 (smooth in between), **and carries every cell forward by that same distance** (sickled cells by 1.3x), so the clear cells are flushed past the viewer and red round cells follow from the source 10 units behind them. 0.25: red is a distant scatter behind the glass. 0.5: red fills the back, glass in front. Sickled cells are all gone by about 0.72, clear round cells by 0.85, full red from about 0.91; 0.91..1 the red keeps flowing. |
| `calm` | 0..1 | 0 | Tumble oscillation falls to 20 %, sway to 50 %, the pulse along the stream to 40 %, and cells left of the axis (local -X, the left of the `hero` frame) are removed progressively: up to 86 % of those with home x < -14. |
| `presence` | 0..1 | 1 | Opacity of the whole field. Nothing is drawn below 0.001. |
| `specimen` | 0, 1, 2 | 0 | Lab only, leave at 0 on the site. 1 = one glass round cell and one glass sickle at the origin, 2 = the same pair in red; the field is hidden. |

Choreography notes:
- **Hold `flow` steady (or move it slowly) while tweening `replace`.** `replace` already moves the stream 178 units on its own. The front's position depends on `replace` only, so cells that `flow` pushes across it scale in or out over an 8-unit band.
- Idle motion from `time` is bounded: sway of +-0.38, a pulse of about +-3 along the stream, slow roll and tumble. Nothing depends on `time` to complete a pose.
- All params combine. `presence` and `calm` are independent of the rest.

### Anchors (`model.anchors`)
- `source`: Vector3 (8, 5, -96), the far end of the stream where the red cells emerge. At 116 units from the hero camera it is almost fully fogged.
- `nearCell`: Object3D that follows one designated sickle cell, larger and steadier than the rest. At `flow = 0, replace = 0` it sits at about local (11.0, -1.6, -16): right of centre, 36 units from the hero camera, about a third of the frame wide. It moves with `flow` (z = -16 + flow) and is in the hero frame for `flow` between about -44 and +20, best between -25 and +12 (modulo 130). It is only a visible cell while `sickled` > 0.02 and `replace` is 0; the anchor keeps updating regardless.
- `centre`: Vector3 (2, 1, -30), a look target in the middle of the visible field.

### Views (`meta.views`)
- `hero`: pos (0, 0, 20), look (2, 1, -40), fov 35. Inside the field, as intended for the site.
- `single`: pos (0, 2.5, 30), look (0, 0, 0), fov 35. Use with `specimen=1` or `2`.
- `far`: pos (150, 70, 120), look (4, 0, -30), fov 35. Whole volume from outside; add `fog=0.002` to see it.

### Cost
- Draw calls from this model: 2 in the opening (glass round, glass sickle), 4 mid-replace (red near, red far, two glass), 2 at full red. No transmission pass. Lab totals including the backdrop: 3, 4 to 5, 3.
- Triangles in the hero view: 275 k at replace 0, 243 k at 0.5, 543 k at 1.
- Frame time, measured with back-to-back uncapped renders at 1440x900, DPR 1, on this MacBook Air M2 while other agents were also using the GPU: opening 2.6 to 5.3 ms, replace 0.5 3.4 to 6.8 ms, replace 1 3.2 to 5.4 ms. `update()` alone costs 0.10 to 0.43 ms. The runs disagree with each other by more than the budget margin, so **under 4 ms is not confirmed**.

### Files
- `src/scene/cells.js`, `src/scene/cells.shapes.js` (the two geometries).
- The returned model also has a `_debug` field (slot lists, `frontAt`) for the lab console; the site can ignore it.

### Final screenshots (`agents/shots/03-cells/`)
- Shapes: `final-single-glass.png`, `final-single-red.png`
- Replace, hero view: `final-hero-replace-000.png`, `-025.png`, `-050.png`, `-075.png`, `-100.png`
- Sickled: `final-sickled-000.png`, `final-sickled-045.png` (with anchor dots), `final-sickled-100.png`
- `final-calm-1.png` (replace 1, calm 1), `final-low.png` (replace 1, low), `final-low-glass.png` (opening, low), `final-presence-05.png`, `final-far-050.png`

## Iteration log
### Round 6
- Changed: crisper clearcoat on the red cells; flow sequence and far views shot; spacing audit over 780 combinations of flow, time and replace. The audit found red cells as close as 2.8 units: the placement ignored that the stream wraps, so cells at the two ends became neighbours. Fixed by making the spacing check periodic. After the fix the closest red pair is 8.06 and no red, round-round or sickle-sickle pair is under 7.8.
- Screenshots: r6-flow-00/04/08/12/40/90, r6-far-0, r6-far-05, then the final set.
- Critique: payoff frame is dense and layered. Left third at calm 1 is thinner but large near cells still cross it. Low-quality opening is sparse on the left.

### Round 5
- Changed: red material deeper and less plastic (lower environment, darker per-cell shade, vertex-colour occlusion in the dimple); stronger rim on distant glass cells.
- Screenshots: r5-single-red, r5-single-glass, r5-hero-0, r5-hero-1.
- Critique: highlights still broad and soft, read as rubber rather than wet. Fixed in round 6.

### Round 4
- Changed: removed the cell-free corridor along the whole axis (it left a dark hole in the middle of every frame) and replaced it with cells parting around the axis near the camera only; red cells split into fine and coarse meshes by distance so the count could go from 340 to 480; front position made a monotone curve so 0.5 shows glass in front of red.
- Screenshots: r4-single-red, r4-hero-0/025/05/075/1.
- Critique: frame now fills. Red still pinkish and plastic in the near cells.

### Round 3
- Changed: clear cells switched from the shared transmissive glass to a blended shell (see R-03-1); instances depth-sorted; sickle made narrower and thicker.
- Screenshots: r3-single-shell, r3-hero-0-shell, r3-hero-0-trans (the comparison), r3-hero-05-shell, r3-single-glass, r3-hero-0/025/05/075/1.
- Critique: shell reads as clear glass, transmissive reads as black lacquer. Centre of frame empty at every replace value.

### Round 2
- Changed: back-wall reflection and rim terms on the glass; cells oriented to show their faces; red fog falls to wine; wider crescent.
- Screenshots: r2-single-glass, r2-single-red, r2-hero-0, r2-hero-05, r2-hero-1.
- Critique: colour split on the glass far too strong (saturated red and blue patches); bodies still opaque black.

### Round 1
- Changed: first version. Evans-Fung disc, crescent, Poisson-disc field, all params.
- Screenshots: r1-single-glass, r1-single-red, r1-hero-0, r1-hero-1.
- Critique: glass looks like obsidian; sickle reads as a banana edge-on; opening costs 15.9 ms.

## Requests
- R-03-1 (open, needs a ruling): **the clear cells do not use the shared transmissive glass.** I cloned it and turned it into a blended shell (transmission 0, black base colour, custom One / OneMinusSrcAlpha blending, depth write off, plus a back-wall reflection and a rim term in `onBeforeCompile`). The contract says not to work around the shared glass privately, so this needs your OK. Reasons: (a) with transmission, a field of 150 cells reads as black lacquer because transmissive cells cannot see each other (compare `r3-hero-0-trans.png` with `r3-hero-0-shell.png`); (b) cost, see R-03-2. Consequence: red cells seen through a clear cell are not refracted, only overlaid.
- R-03-2 (open, for 01-helix and 02-cas9 too): **`dispersion: 4` on the shared glass is very expensive.** On my field the opening took 15.9 ms with the shared glass and 2.7 ms with the same material and `dispersion = 0`, one measurement each. The helix placeholder alone measured 9.1 ms. Proposed: set dispersion to 0 on the shared glass, or keep it only on one or two hero meshes.
- R-03-3 (open, low priority): the shared `arterial` looked plastic on the cells (pink sheen, broad white highlights). My clone uses roughness 0.45, clearcoat 0.6, clearcoatRoughness 0.07, sheen 0, envMapIntensity 0.5, plus shader terms for a darker facing surface, a red edge glow and wine-coloured fog. No change to the shared material is needed unless another model uses it for large surfaces.

## Known issues
- **Budget not confirmed** (see Cost). If it is over, the cheapest lever is the red slot count (480) in `create()`.
- **Clear round and sickled cells pass through each other while `replace` is between 0 and about 0.72**, because sickled cells are flushed 1.3x faster. Centre distances drop to 1.4 units. Both are blended shells, so it shows as overlapping outlines, not as clipping. At `replace` 0 and 1 there are no close pairs.
- The audit checks centre distances, not actual surface intersection, and only for the cells' own motion; sickle cells are up to about 15 units long, so a sickle can still touch a neighbour 8.3 units away.
- Motion was judged from stills at several `flow` values, not from video. The wrap is hidden by scaling cells in over the first 8 units at the far end and out over the last 3 at the near end (behind the hero camera); from the `far` view that scaling is visible.
- `presence` between 0 and 1 switches the red material to transparent; the first switch compiles a second shader program and may hitch for a frame. The two glass meshes are each depth-sorted, but not against each other.
- `calm = 1` thins the left of the frame but does not empty it: a few large near cells still cross the left edge (`final-calm-1.png`).
- On `low` the opening has only 76 clear cells and the left half of the hero frame is nearly empty (`final-low-glass.png`).
- Red cells swap between a fine and a coarse mesh at 48 units from the camera. I did not check that swap in motion.
- The glass has faint warm and blue fringes on its highlights (wanted by the brief). If the opening must be strictly neutral, set the two `0.04` offsets in `makeGlass` to 0.
- Everything assumes group scale 1 and fog density 0.012. Scaling the group changes how far the fog reaches into the field.
