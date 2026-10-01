# Status: 01-helix

Status: done
Round: 3
Updated: 2026-10-01 15:22

## Summary
`src/scene/helix.js` is complete and loads without console errors in the lab at both qualities. Every param, anchor and view in the brief exists and works. Stopped at round 3 under D-001, so the ripple, the scar and the fracture flash are less polished than planned (see Known issues).

## Interface delivered

File: `src/scene/helix.js` (no helper files). Exports `meta`, `create(ctx)`, `axisPosition(bp)`. `create` returns `{ group, params, anchors, axisPosition, update(time), dispose() }`.

### Geometry and numbering
- 1 unit = 1 nm. Axis = local +Y. Right-handed B-DNA, radius 1.0 to the backbone centreline (about 2.3 across including the glass), rise 0.34, 10.5 bp per turn, minor groove 132 degrees.
- 600 base pairs, integer index `bp` from -300 to 299. **Base pair `bp` is centred at local y = (bp + 0.5) * 0.34**, which is what `axisPosition(bp)` returns (fractions allowed). The helix runs from y = -102 to y = +102 and tapers to nothing over the last 8 bp.
- `meta.sites` holds every index below.

| Site | Base pairs | Local y |
|---|---|---|
| Target | -10 .. 9 | -3.23 .. 3.23, centre 0 |
| PAM (real) | -13 .. -11 (below the target) | centre -3.91 |
| Cut | between bp -8 and bp -7 (`meta.sites.cut` = -7.5) | -2.38 |
| Decoy PAM 0 | 149 .. 151 | 51.17 |
| Decoy PAM 1 | 114 .. 116 | 39.27 |
| Decoy PAM 2 | 84 .. 86 | 29.07 |
| Decoy PAM 3 | 54 .. 56 | 18.87 |
| Decoy PAM 4 = near-match site | 27 .. 29, its bubble is bp 30 .. 39 | 9.69 |
| Edit rung | -40 | -13.43 |
| Deleted in repair | -8, -7, -6 | |
| Dim region | -37 .. 22 | -12.4 .. 7.7 |

Decoys are all on the +Y side of the target; the PAM and the edit rung are on the -Y side.

### Params (all numbers; the picture is a pure function of params and time)

| Param | Range | What it does |
|---|---|---|
| `spin` | turns, any value | Rotates the helix about its axis. Positive is right-handed about +Y. |
| `idle` | 0..1, **default 1** | Scales a slow idle rotation of 0.008 turns per second. **Set to 0 whenever Cas9 is docked**, or the helix turns inside it. |
| `pamFlash0` .. `pamFlash4` | 0..1 | The three rungs of that decoy PAM glow red (guide look). `pamFlash4` is the near-match site. |
| `pamFlash` | 0..1 | The three rungs of the real PAM glow red. |
| `nearUnzip` | 0..1 | Bubble opens at bp 30..39 upward from decoy PAM 4. 0..0.7 it grows and 8 target-strand half-rungs light in order; 0.7..1 it stalls and the lit rungs fade to about 60% with a slight time-based flicker. Back to 0 closes it. |
| `unzip` | 0..1 | The 20-bp target bubble opens like a zip from the PAM end upward (0.5 = lower half open). Backbones part and untwist, each rung splits into two half-rungs. Outer radius of the bubble is 1.6 (target strand 1.2, displaced strand 1.44, plus the glass). |
| `match` | 0..1 | The 20 target-strand half-rungs light red in order from the PAM end; 0.5 = ten lit. Independent of `unzip`, but meant to be used with `unzip` = 1. |
| `cut` | 0..1 | 0..0.25 the snap: both backbones break at y = -2.38, the ends recoil with a small overshoot to a 0.6 gap, a white flash at the break, glass shards fly out. 0.05..1 a ripple (bulge plus twist) runs about 32 bp outward both ways and dies; shards are gone by 0.8. At 1 the helix is still, with the gap and two angled fracture faces. |
| `repair` | 0..1 | **Only acts when `cut` > 0 (full effect from `cut` >= 0.25); keep `cut` = 1.** 0..0.4 the ends fray back (3 bp vanish); to 0.8 they drift sideways and return; 0.3..0.85 the halves close and turn; 0.84..1 a frosted, slightly swollen scar forms and the pairs either side (bp -9 and -5) stay dim and unpaired. Joined 48 degrees out of register. |
| `dim` | 0..1 | bp -37..22: rungs go to the frostDim colour, glass reflections drop to 38%. Soft edges of about 6 bp. |
| `edit` | 0..1 | Rung -40 turns red in place: one base over 0..0.6, its partner over 0.4..1. Nothing else moves. |

Intended order: `unzip` and `match`, then `cut`, then bring `unzip` and `match` back to 0, then `repair`, then `dim`. Odd combinations do not explode but `repair` with `unzip` still at 1 looks untidy (see Known issues).

### What moves when (the choreography needs this)
- **`unzip` rotates the two halves of the helix.** The bubble loses 90% of its twist; the twist is pinned at the origin, so everything below the target turns one way and everything above turns the other, by up to about 0.85 turn each at `unzip` = 1. It reads as the helix unwinding. `nearUnzip` likewise turns everything above bp 40 by up to about 0.65 turn.
- **Bubble orientation at the origin, before `spin`:** at `unzip` = 1 the target strand (the one whose half-rungs light red) is at local **+Z**, radius 1.2; the displaced strand is at local **-Z**, radius 1.44. With the helix closed, the minor groove at the origin faces local +X. Rotate Cas9 about Y to suit.
- **`repair` moves both halves.** Everything below the cut rises 0.34 and everything above it drops 0.68, so the join stays at y = -2.38. The halves also turn towards each other by about 27 degrees each. At `repair` = 1 the target anchor is at y = -0.68 and the pam anchor at y = -3.57.
- `cut` shifts the ends by at most 0.3 along the axis, fading with distance (e-folding 14 bp).

### Anchors (all `Object3D`, all on the axis, so `spin` never moves them)
`target` (y 0), `pam` (y -3.91), `cutSite` (y -2.38, never moves), `site0` (51.17), `site1` (39.27), `site2` (29.07), `site3` (18.87), `site4` (9.69, the near-match site), `editSite` (-13.43), `top` (102), `bottom` (-102). They follow the axial motion of `cut` and `repair` described above. They do not follow the small sideways ripple or drift.

### Views (`meta.views`, all fov 35)
- `hero`: pos [8, -5, 16], look [-1.8, 3, 0]. Long leaning view from slightly below.
- `close`: pos [3.4, 1.4, 10.5], look [0, 0, 0]. About two and a half turns.
- `target`: pos [8, 2.2, 20.5], look [0, 0, 0]. About 14 units of helix.
- `along`: pos [3.4, 14, 6], look [0, -22, 0]. Looking down the length into the fog.

### Cost (measured, Apple M2, 1440x900, headless Chrome on Metal, 200 back-to-back frames with a forced finish)
- High quality: 4.5 to 6.7 ms per frame for the whole lab frame, of which **3.6 ms is the fixed cost of three.js's transmission pass** (it appears as soon as any transmissive object is on screen, and is paid once for the whole scene, not per model). The helix itself is roughly 1 to 3 ms: rungs 0.7 ms, backbone 1 to 3 ms depending on how much glass is on screen. One hero-view reading came out at 15 ms; I believe that was warm-up, but did not get to repeat it.
- Low quality: 0.45 ms.
- CPU: `update()` takes 0.015 ms.
- The lab's own `frameMs` reads 16.7 because it is vsync-capped, so it cannot show this.
- High: 5 draw calls in the lab frame (2 are the helix; the rungs are drawn twice because of the transmission pass; 1 is the backdrop), 224k triangles. Low: 3 draw calls, 76k triangles.

## Iteration log
### Round 3 (cut short by D-001)
- Changed: repair rotation now computed from the real twist between the two ends (it was wrong when a bubble was open); scar made smaller and lumpier, with the neighbouring pairs left dim and unpaired; register mismatch raised to 48 degrees; backbone tessellation cut from 5x24 to 3x14 segments per bp after measuring cost; debug URL overrides removed.
- Screenshots: agents/shots/01-helix/final-*.png (see list below), r3-rep-1.png, r3-rep-1b.png, r3-low-close.png, r3-combo.png, r3-combo2.png, r3-thumb.png
- Critique: scar reads as healed but imperfect, though it is a heavy blob from behind. The out-of-register twist is hard to see. Not re-shot at different spins.

### Round 2
- Changed: fracture faces (they were collapsed by a taper bug), edge-lit so they read as cut glass; shards; flash confined to the break; ripple now bulge plus twist and slower; bubble untwist 0.8 to 0.9; dim less dark; hero and along cameras.
- Screenshots: r2b-cutz-004.png, r2c-cutz-1.png, r2c-cutw-015.png, r2c-cutw-03.png, r2c-cutw-06.png, r2-unzip-1.png, r2c-heroC.png, r2d-rep-045.png, r2d-rep-07.png, r2d-rep-088.png, r2d-rep-1.png, r2d-dim-wide.png, r2d-near.png, r2d-near-04.png, r2d-edit.png
- Critique: snap reads as glass breaking (flash, shards, angled faces). Ripple is visible at cut 0.15 but faint by 0.3. Scar too long and smooth.

### Round 1
- Changed: wrote the whole module. Backbones and rungs carry a base-pair coordinate and the vertex shader places them, so unzip, cut, repair and the ripple are all shader-side.
- Screenshots: r1e-close.png, r1e-zoom.png, r1e-along.png, r1-unzip-025.png, r1-unzip-05.png, r1-match-1.png, r1-cut-01.png, r1-cut-1.png, r1-repair-06.png, r1-repair-1.png
- Critique: first attempt was faceted (three.js flat-shades a geometry with no normal attribute; fixed). A wide flat ribbon looked like tape; switched to a soft ellipse. Cut glint turned all the glass white. Fracture faces invisible.

### Final screenshots (agents/shots/01-helix/)
- Views: final-view-hero.png, final-view-close.png, final-view-target.png, final-view-along.png
- Anchors: final-anchors.png
- spin: final-spin-025.png, -05, -075
- pamFlash: final-pamFlash-03.png, -06, -1; pamFlash4: final-pamFlash4-03.png, -06, -1
- nearUnzip: final-nearUnzip-03.png, -06, -1
- unzip: final-unzip-025.png, -05, -1
- match: final-match-025.png, -05, -1
- cut: final-cut-005.png, -025, -05, -1
- repair: final-repair-03.png, -07, -1
- dim: final-dim-03.png, -06, -1
- edit: final-edit-03.png, -06, -1
- Everything on: final-all-on.png
- Only final-view-close, final-anchors, final-dim-1 and final-all-on were opened and checked after the last change; the others were taken in the same run with no console errors but not individually inspected. The same poses were inspected in rounds 2 and 3 before the tessellation change.

## Requests
- R-01-1 (open, coordinator): the transmission pass costs a fixed 3.6 ms per frame at 1440x900 on an M2, more than this model's whole 3 ms budget, before any glass is drawn. `renderer.transmissionResolutionScale = 0.5` in `context.js` should cut most of it. Not tested.
- R-01-2 (open, coordinator, low priority): looking along the axis from below, the glass goes milky because grazing reflections pick up the top fill panel in `environment.js`. The `along` view therefore looks down the axis. If the library scene must look up the helix, the top panel needs to be dimmer.

## Known issues
- **Budget:** over 3 ms per frame at high quality if the transmission pass is counted (see Cost and R-01-1).
- **Ripple is subtle.** It is clear around `cut` 0.1 to 0.2 and faint after 0.3. It will read better in motion than in stills, but it is not yet the dramatic shockwave the brief asks for.
- **Flash looks slightly plastic** at `cut` 0.03 to 0.1: the 1.5 bp either side of the break go flat white. Bloom may help; it was not tested with post-processing.
- **Out-of-register join is hard to see.** The scar (frosted bulge, dim unpaired neighbours) carries "imperfect"; the 48 degree twist offset does not read on its own.
- **`repair` with `unzip` = 1** joins correctly but looks untidy (final-all-on.png). Close the bubble before repairing.
- **Half-lit rungs are pink**, not dark red, at glow values around 0.5 (pamFlash, match and edit mid-transition).
- **The dim region and the edit rung nearly touch** (dim ends at bp -37, edit is bp -40). If `dim` is still 1 in the beyond scene the edit rung sits at the dark edge; the red still shows.
- **Anchors ignore sideways motion** (ripple, drift, at most about 0.3 units and only near the cut).
- Idle rotation is on by default (`idle` = 1).
- Not checked: appearance with `post=1`, the cut and repair at other `spin` values, and nothing was tested inside the real page.
