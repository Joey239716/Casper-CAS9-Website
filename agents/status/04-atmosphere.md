# Status: 04-atmosphere

Status: done
Round: 3
Updated: 2026-10-01 15:22

## Summary
`src/scene/nucleus.js` is finished to the reduced scope in D-001: the descent and the haze both work and load without errors in the lab, alone and with the helix. I stopped after three rounds, so the look is good at 0, 0.2, 0.35 and 0.7 but not fully polished elsewhere, and the final build is probably over the 3 ms budget between descent 0.3 and 0.55 (see Known issues). I never edited `letters.js` or `post.js`; they were still the original placeholders when the coordinator took them over.

## Interface delivered

Files: `src/scene/nucleus.js` and its private helper `src/scene/nucleus.geometry.js`.

### Placement (read this first)
- **Put `nucleus.group` exactly where `helix.group` is: same position, same rotation, scale 1.** The group's origin is the clearing (where the helix sits) and its local Y axis is the helix axis.
- **The descent layer places itself.** Every `update()` it copies `ctx.camera`'s world matrix, so the dive is always straight down the lens whatever the camera is doing. You do not park the camera at the group origin. The camera may sit still or drift during `spare`; either works.
- **Call `nucleus.update(time)` after the camera has been positioned for the frame**, otherwise the descent layer lags the camera by one frame.
- `follow=0` gives the literal reading of the brief instead: the descent layer sits at the group origin looking down local -Z, and the camera must be parked there. With `follow=0` the haze is then around the camera, not the helix, so I do not recommend it.
- The descent cannot hide the helix (the helix is nearer than the envelope). **Keep the helix invisible until descent is about 0.85**, then fade it in.
- For the last stretch (0.8 to 1) the fibres part around the lens axis, so have the camera looking at the helix by then.

### Params (`model.params`)
| Name | Range | Default | What it does |
|---|---|---|---|
| `descent` | 0..1 | 0 | The dive. Pure function of this number. 0 outside the envelope; 0.2 hero pore large ahead; 0.30 pore rim fills the frame; 0.35 inside the channel, looking through the basket ring at chromatin; 0.4 to 0.55 thick compacted fibres; 0.55 to 0.8 beads on a string; 0.8 to 1 bare threads parting; at 1 the whole descent layer is behind the camera and is switched off (zero cost). |
| `haze` | 0..1 | 1 | Opacity of the static chromatin haze around local Y. It is gated by descent: invisible below descent 0.7, ramps in to full at descent 1. So tweening `descent` alone gives the whole sequence, and after `spare` you leave `descent = 1` and use `haze` as the dial. I suggest about 0.5 in close molecular scenes. |
| `presence` | 0..1 | 1 | Master fade for both layers. At 0 the module draws nothing. Set it to 0 before `spare` (at `descent = 0` the envelope fills the screen). Intermediate values fade solid parts towards the fog colour rather than making them transparent, so use it as a quick fade, not a long dissolve. |
| `follow` | 0 or 1 | 1 | 1: descent layer rides `ctx.camera`. 0: it stays at the group origin looking down local -Z. |

Typical choreography: `presence` 0 to 1 at the start of `spare`; `descent` 0 to 1 across `spare`; from `library` onward `descent = 1`, `haze` about 0.5.

### Anchors (`model.anchors`)
- `pore`: Object3D at the centre of the pore the camera passes through. It moves with the descent; it is ahead of the camera until descent 0.35 and behind it afterwards, so only use it for an annotation before 0.33.
- `clearing`: Object3D at the group origin, where the helix is at the end of the descent.

### Views (`meta.views`), all fov 35
- `hero`: pos [0,0,28], look [0,0,0]. Use with `descent=0.15`.
- `inside`: same camera. Use with `descent=0.55`.
- `arrive`: same camera. Use with `descent=1`.
- `haze`: pos [10,-15,24], look [0,5,0]. Use with `model=nucleus,helix&view=haze&descent=1`.
The lab does not read params from views, so pass `descent` in the query. The camera is 28 units back rather than at the origin because the group origin is the helix; the descent follows the camera, so the camera position does not affect it.

### Sizes and other facts
- Descent units are arbitrary and camera-relative (independent of the group's scale). Total travel 880 units; envelope 150 units ahead at descent 0; it draws up to 290 units ahead with its own fog, not the scene fog.
- Haze: 68 soft strands (34 on low), local Y from about -110 to +110, radii 17 to about 70 from the Y axis, nothing inside 16. It uses the scene fog density and fades out within 9 to 26 units of the camera so nothing blocks the lens.
- The camera rolls 0.55 rad about its axis over the dive (built into the descent layer, the real camera is not touched).
- The haze, the dust and nothing else are additive and drawn in the opaque pass with `renderOrder` 5 and 6, so clear glass refracts them. A backing dome (`renderOrder` -999) paints a faint deep-field glow at the vanishing point during the dive and fades out between descent 0.8 and 1.
- Colour: tokens only (`frost`, `darkfield`, `deepField`); no red anywhere.
- `quality=low` halves fibre, bead, dust and haze counts and texture sizes.

## Iteration log
### Round 3
- Changed: nearest-pore map now carries a continuous distance channel (removed the hairline seams between pores); every pore has filaments; per-layer minimum radius so far fibres cannot wander next to the lens; smaller beads-on-a-string; gentler parting at the end; darker tones.
- Screenshots: agents/shots/04-atmosphere/final-descent-000.png, -020, -035, -050, -070, -090, final-descent-100.png (with helix), final-haze-helix.png, final-haze-off.png, final-low-050.png. Earlier: r3-*.png, r3b-*.png.
- Critique: 0, 0.2, 0.35 and 0.7 are good pictures. 0.5 reads as chromatin but the bead ropes still look a little like a plastic model. 0.9 shows only the haze and dust; the parting threads have already left the frame. Clear transmission glass for the pores was tried and cost 14 to 35 ms a frame, so the pores are polished smoked frost instead.

### Round 2
- Changed: smoked-glass look (dark, glossy frost clones with a rim term), pool of light on the envelope, baked Perlin bump with analytic gradients instead of procedural noise, bead LOD, chunk culling.
- Screenshots: agents/shots/04-atmosphere/r2-*.png
- Critique: blocky facets on the wall (value noise and a creased dimple), hexagonal far beads, zone C clamped inside the envelope sphere so nothing at 0.9.

### Round 1
- Changed: first full build: envelope, pores, three chromatin zones, dust, backing glow, haze.
- Screenshots: agents/shots/04-atmosphere/r1-*.png
- Critique: bright matte clay look, 2 M triangles and 8 to 13 ms a frame.

## Requests
None.

## Known issues
- **Performance is probably over budget in the middle of the dive.** `npm run shot` is vsync-capped, so I timed real cost with my own script (N renders then a readPixels, 1440x900, Apple M2, quality high). The round before last measured 2.1 to 2.7 ms across the dive. The final build measured 3.4 to 5.8 ms, but other agents were using the GPU at the same time and the numbers were noisy (the same frame read 2.5 ms and 5.8 ms minutes apart). Triangle counts did rise in the last change (1.39 M at descent 0.35, 1.29 M at 0.5, up from 1.13 M and 1.18 M), so I expect 0.3 to 0.55 to be at or a little over 3 ms. Not re-measured on a quiet machine. Cheapest fixes: lower `LOD_NEAR` from 130 to 90, or cut zone A fibre counts (`half(5)`, `half(7)`, `half(8)`) in nucleus.js. Descent 0.9 measured 0.6 ms and descent 1 (haze only) 0.2 ms; `quality=low` at 0.5 measured 2.7 ms.
- Haze at `haze = 1` competes with the helix a little: a few strands cross in front of it at similar brightness (see final-haze-helix.png). Use about 0.5, or lower `HAZE_OPACITY` in nucleus.js.
- Descent 0.9 and 1 without the helix are sparse: only haze and dust. Zone C threads have left the frame by 0.9.
- Additive layers (haze, dust) blend slightly differently with post-processing on, because the blend happens before tone mapping instead of after. Not compared side by side.
- The compacted "30 nm fibre" in zone A is the textbook picture; its existence in living cells is disputed. It is unlabelled staging, but worth knowing if the copy mentions it.
- Not tested: `presence` at intermediate values, `follow=0`, window resize, and a moving camera during the dive.
- `letters.js` and `post.js`: I made no edits to either.
