# Brief 03: red blood cells

You build the cells that open and close the story. The site starts in a field of clear glass cells, many of them sickled, and ends with the screen filling with round red ones. That ending is the only moment of full colour on the whole site, and the single boldest image in it. It must be gorgeous.

## You own

- `src/scene/cells.js` (replace the placeholder)
- Optional private helpers named `src/scene/cells.*.js`
- `agents/status/03-cells.md`, `agents/shots/03-cells/`

## What it is

A field of red blood cells drifting and tumbling through a volume, viewed from inside or just outside it. Units are micrometres.

- **Round cell:** a biconcave disc, about 7.8 across and 2.2 thick at the rim, with the central dimple on both faces. Use the real profile (the Evans–Fung equation is the standard one), not a squashed sphere or a torus.
- **Sickled cell:** an elongated crescent, pointed at both ends, flattened, with a slight twist. Rigid-looking. Vary them a little (length, curvature) so they are not clones.
- The two shapes are separate geometries. Cells never morph from one into the other, because real sickled cells do not un-sickle. The change is always by *replacement*: new cells arrive, old ones leave.
- Depth is the point. Spread cells from very near the camera to far into the fog so that any camera movement produces strong parallax. A few large, soft, near cells crossing the frame do a lot.

## Params

| Param | Range | What the viewer sees | Scene |
|---|---|---|---|
| `flow` | any number | Advances every cell along the stream (positions are a pure function of `flow` and `time`; cells wrap around the volume seamlessly). The coordinator ties this to scroll, so scrolling moves the cells. | problem, payoff |
| `sickled` | 0..1 | Fraction of the clear-glass population that is sickle-shaped. The site uses about 0.45 for the opening. | problem |
| `replace` | 0..1 | The payoff. Round **red** cells (the `arterial` material) stream in from the far end of the volume and fill it, front to back, while the clear glass cells, sickled ones first, thin out and are gone by about 0.85. At 1 the frame is full of round red cells. Around 0.5 there is a clear front: red arriving behind clear glass. | payoff |
| `calm` | 0..1 | At 1, tumbling slows and the field settles into a gentle drift, sparse enough in the left third of the frame to sit behind text. | practice |
| `presence` | 0..1 | Overall fade in and out of the whole field. | problem, payoff |

Idle motion from `time`: slow tumbling and drifting.

## Anchors

`source` (where the new red cells stream from), `nearCell` (one prominent sickled cell near the camera, for an annotation), `centre`.

## Views

`hero` (inside the field, as the site will show it), `single` (one round and one sickled cell side by side, close, for judging the shapes), `far` (the whole volume from outside).

## Acceptance criteria

1. Both shapes are correct and unmistakable in silhouette. The biconcave dimple is clearly visible in the glass highlights and in the red shading. The sickle is clearly a crescent with points, not a banana.
2. Clear-glass cells look like blown glass: bright rim lines, a soft dark body, faint spectral fringes. The opening scene has no colour at all.
3. Red cells look rich and wet, deep arterial red with a soft highlight sweeping across the dimple, not flat, not plastic, not neon. If the shared `arterial` material is not good enough, say so under *Requests* with a proposed setting.
4. At `replace=1` the frame is densely and beautifully filled: layered depth, no obvious grid or repetition, no cells intersecting each other near the camera.
5. Motion is smooth and wraps without visible pops as `flow` increases.
6. Budget: under 4 ms per frame at `quality=high` with the full field, 6 draw calls or fewer. Use `InstancedMesh`; per-instance motion should be computed cheaply (in the vertex shader, or a tight loop over a few hundred matrices at most). About 250 to 400 cells on `high`, about half on `low`.

## Rounds

At least five. Start by getting the two shapes right in the `single` view before building the field. Final shots in `agents/shots/03-cells/final-*.png`: both shapes close up in glass and in red, the `hero` view at `replace` 0, 0.25, 0.5, 0.75 and 1, `sickled` at three values, `calm=1`, and one at `quality=low`.

## The scenes you appear in (for context)

- **problem** ("One letter changes the shape of a cell."): clear glass sickle-shaped and round cells tumble past at several depths. No colour yet.
- **payoff** ("The spare comes back on."): the camera pulls back out of the nucleus. New cells stream from the marrow, the sickled ones thin out, and the screen fills with round red cells. This is the colour moment.
- **practice:** the scene settles to slow-drifting red cells behind clinical content.
