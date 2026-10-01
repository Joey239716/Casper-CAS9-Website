# Brief 04: atmosphere

You build everything around the hero models that makes the scenes feel deep and cinematic: the dive into the cell nucleus, the drifting letters of the genetic code, and the post-processing. Parallax depth is the brief for the whole site, and most of it comes from your layers.

## You own

- `src/scene/nucleus.js`, `src/scene/letters.js`, `src/scene/post.js` (replace the placeholders)
- Optional private helpers named `src/scene/nucleus.*.js`, `letters.*.js`, `post.*.js`
- `agents/status/04-atmosphere.md`, `agents/shots/04-atmosphere/`

## 1. `nucleus.js`: the descent, and the chromatin haze

Two jobs in one module.

**The descent (`descent`, 0..1).** In the scene called `spare`, the camera dives from outside a blood stem cell's nucleus down to a single DNA helix. The real scale change is about a thousandfold, so this is staged, not literal. Your module is *camera-relative*: the coordinator parks the camera at your group's origin looking down local −Z, and you move the world past it as `descent` goes from 0 to 1:

- 0.0: the nuclear envelope fills the view as a vast curved wall of frosted glass, studded with nuclear pores (ring-shaped openings in a regular but organic scatter).
- 0.0 to 0.35: approach, and pass *through* one pore. The pore's rim should sweep past the edges of the frame.
- 0.35 to 0.8: inside. Chromatin: tangled, looping fibres at several depths rush past, thick and near at first, then thinner. Beads-on-a-string detail (nucleosomes) on the nearer fibres is welcome if it looks good.
- 0.8 to 1.0: the fibres part and thin out, leaving a clear dark space ahead where the helix will be, with only distant fibres remaining.

This must feel like continuous forward motion with strong parallax between near and far layers. Because it is scrubbed by scroll, it is a pure function of `descent`.

**The haze (`haze`, 0..1).** For the molecular scenes that follow, the same module provides a static, world-space layer of distant, soft chromatin fibres surrounding the helix: in nanometre units, spanning about ±110 units along local Y, at radii from 14 to 70 units from the Y axis, and **nothing within 12 units of the axis** (that space belongs to the helix and Cas9). These sit in fog and give the camera something to move past. `haze` is their overall opacity.

Other params: `presence` if useful. Anchors: `pore` (the pore the camera passes through), `clearing` (the point where the helix will be at the end of the descent).

Views: `hero` (the descent at 0.15, envelope and pore ahead), `inside` (descent 0.55), `haze` (looking along a placeholder helix with haze on; test with `model=nucleus,helix`).

## 2. `letters.js`: the genetic text

A far layer of drifting letters A, T, C and G, set in the site's display typeface, **Bodoni Moda** (loaded by the page from Google Fonts; in `create`, `await document.fonts.load('400 96px "Bodoni Moda"')` before drawing glyphs to a canvas texture, and fall back gracefully if it fails).

- Instanced quads in a volume around the Y axis, same exclusion zone as the haze. Mostly small, dim and soft (bake two or three blur levels into the atlas and assign by distance, so far letters look out of focus). A few larger and sharper.
- Colour: the `frost` and `glass` tokens only, low contrast. They are atmosphere, never competing with the helix or the copy.
- They face the camera, or hold a fixed orientation, your judgment on which looks better; they drift slowly from `time`.
- Params: `opacity` (0..1), `drift` (a scroll-tied offset along Y so letters stream past as the camera travels, wrapping seamlessly), and `sequence` (0..1): one straight line of letters running parallel to the helix a few units from it, of which twenty consecutive letters turn arterial red as `sequence` goes to 1. This is the one place your layers use the accent; keep it thin and precise. Label nothing; the page handles text.

Views: `hero`, `withHelix` (test with `model=letters,helix`).

## 3. `post.js`: post-processing

`export function createPost(ctx)` returning `{ params, render(dt, time), setSize(w, h), dispose() }`, built on Three's `EffectComposer`.

- **Bloom on the red only.** Clear glass has very bright white highlights and they must stay crisp, not glow. Write the bright-pass so it responds to *redness* (roughly `r − max(g, b)`), so only the guide thread, PAM flashes, lit rungs and the cut flare bloom. Param `bloom` (strength).
- **Colour split.** A radial chromatic-aberration pass, param `split` (0..1), zero cost to the eye at 0, used for a fraction of a second at the cut. At 1 it should look like the lens was struck, not like a cheap glitch filter.
- **Vignette**, subtle, param `vignette`. Optional very fine grain, param `grain`, off by default.
- Keep anti-aliasing (multisampled render target) and correct tone mapping and colour space: with `post=1` and all params at 0 the picture must match the plain renderer.
- On `quality=low`, bloom at half resolution and no colour split unless `split > 0`.

Test with `model=helix&post=1&post.bloom=1` and with any red geometry you add temporarily *in the lab console*, not in other agents' files.

## Acceptance criteria

1. The descent gives a real sense of plunging through layered space; freeze-frames at 0, 0.2, 0.35, 0.5, 0.7, 0.9 and 1 are each a good picture.
2. Haze and letters add depth without ever drawing the eye away from the helix. With `model=helix,nucleus,letters` the helix still dominates.
3. Nothing in your layers uses colour except the twenty `sequence` letters.
4. Post-processing at rest is invisible; bloom affects red only; the split looks optical.
5. Budget: nucleus under 3 ms, letters under 1 ms, post under 2.5 ms per frame at 1440x900 on `quality=high`. Everything in the thousands is instanced.

## Rounds

At least five across the three modules, with the most time on the descent. Final shots in `agents/shots/04-atmosphere/final-*.png`: descent at seven values, haze with helix, letters with helix, `sequence` at 0 and 1, and post on/off comparisons including `split` at 0.5 and 1.

## The scenes you appear in (for context)

- **spare:** the camera descends into a blood stem cell: through the nuclear envelope, past chromatin fibres, down to one helix.
- **library:** the camera travels along the helix; A, T, C, G drift past in the far layer.
- **match:** the twenty letters that matter light up.
- **cut:** the colours split for a moment, then everything goes still.
- All molecular scenes: haze and letters as the parallax layers.
