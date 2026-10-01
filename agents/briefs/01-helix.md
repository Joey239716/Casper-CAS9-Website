# Brief 01: the DNA helix

You build the centrepiece of the site: a glass DNA double helix. It is on screen for nine of the thirteen scenes and every other model is judged next to it. It has to be beautiful when it is doing nothing, and it has to perform the whole mechanism of CRISPR editing through its params.

## You own

- `src/scene/helix.js` (replace the placeholder)
- Optional private helpers named `src/scene/helix.*.js`
- `agents/status/01-helix.md`, `agents/shots/01-helix/`

## What it is

- B-DNA, in nanometres: 2 units across, 0.34 rise per base pair, about 10.5 base pairs per turn, right-handed, with a visibly wide major groove and narrow minor groove. Get the handedness and grooves right: clinicians will notice a left-handed or symmetric helix.
- Straight, along local +Y. **About 600 base pairs long** (roughly 204 units), so the camera can travel along it and its ends are lost in fog. The centre of the 20-bp target site is at the local origin.
- Two clear-glass backbones (`ctx.materials.glass`) and one frosted rung per base pair (`ctx.materials.frost`, instanced). Consider giving each rung a visible join in the middle so it reads as a *pair* of bases; it also gives you the two halves you need when the helix unzips.
- The coordinator will rotate the whole group, so do not bake in a tilt.

## Layout along the helix

Number base pairs from the target centre. Define and document these in `meta`:

- **Target site:** 20 bp centred on the origin.
- **PAM:** the 3 bp immediately next to the target on one side.
- **Cut site:** between the 3rd and 4th base pair of the target counting from the PAM.
- **Decoy sites:** five more PAM positions spread along one side of the target (for example 150, 115, 85, 55 and 28 bp away), where Cas9 lands during the search and leaves again. One of them, the nearest, is the *near-match* site.

## Params (all pure functions of the value; see CONTRACT section 3)

| Param | Range | What the viewer sees | Scene |
|---|---|---|---|
| `spin` | turns | Rotation about the helix axis. | all |
| `pamFlash0` … `pamFlash4`, `pamFlash` | 0..1 | The three PAM rungs at that decoy site (or at the real PAM) glow red (`guide` material look). | search |
| `nearUnzip` | 0..1 | A small bubble opens at the near-match decoy site, and at most the first 8 rungs light red, then stall. Returning to 0 closes it. | match (aside) |
| `unzip` | 0..1 | The 20-bp bubble at the target opens: the two backbones part and each rung splits into two half-rungs that stay attached to their own strand. The bubble's outer radius must stay within 1.7 units of the axis so it fits inside Cas9's channel. | match |
| `match` | 0..1 | The 20 half-rungs on the target strand light red one after another, starting at the PAM end (guide RNA pairing letter by letter). At 0.5, ten are lit. | match |
| `cut` | 0..1 | Both backbones break cleanly at the cut site. 0 to about 0.25 is the snap itself (a clean fracture, the two halves recoil a little apart along the axis); the remainder is a ripple that travels outward along the glass in both directions and dies away, leaving the helix still with a visible gap. | cut |
| `repair` | 0..1 | The two ends drift, then rejoin with a few base pairs missing, so the helix on one side is rotated slightly out of register with the other and the join is visibly imperfect (a small scar, not a seamless weld). | repair |
| `dim` | 0..1 | About 60 bp around the repaired site (the "switch") loses its light: rungs go to the `frostDim` look and the glass there goes quieter. | repair |
| `edit` | 0..1 | Independent of the above: one single rung, 30 bp from the target on the far side from the decoys, changes in place from frost to glowing red without the strand breaking. | beyond |

`unzip` and `match` are applied before `cut`; `cut` before `repair`; they will be driven in that order but must not explode if combined oddly.

## Anchors (Object3D, so they follow the animation)

`target`, `pam`, `cutSite`, `site0` … `site4` (decoys, `site4` nearest the target), `editSite`, `top`, `bottom`. Also export a helper `axisPosition(bp)` returning the local Y for a base-pair index, and put the base-pair indices of every site in `meta`.

## Views

`hero` (a long diagonal view showing a good length of helix), `close` (two or three turns filling the frame), `target` (the target site at the distance Cas9 will be viewed, roughly 14 units of helix visible), `along` (near the axis looking down its length, the camera-travel view).

## Acceptance criteria

1. Reads instantly as DNA at thumbnail size, and still looks refined when two turns fill a 1440-pixel frame: no faceting on the tubes, no shading seams, no z-fighting where rungs meet backbones.
2. Right-handed, with clearly unequal grooves.
3. Glass edges catch the light: there are continuous bright edge lines along the backbones from most angles, and faint spectral fringes at the edges.
4. Every param looks good at 0, 0.25, 0.5, 0.75 and 1, and nothing pops between neighbouring values.
5. The cut reads as glass snapping, not as two tubes sliding apart. This is the single most dramatic moment of the site.
6. The repaired join reads as "healed but imperfect".
7. Budget: under 3 ms per frame alone in the lab at `quality=high`, 20 draw calls or fewer, under 600k triangles. Use shader-side deformation or a short separately-built middle section for the animated region, not 600 bp of geometry rebuilt on the CPU each frame.

## Rounds

At least five. In each round take shots of `hero`, `close` and the params you touched at several values, and look at them. By the end, `agents/shots/01-helix/final-*.png` must cover every param at three values, plus all four views, plus one shot with `anchors=1`.

## The scenes you appear in (for context)

- **title:** a single glass helix turning in the dark, lit from one side.
- **library:** the camera travels along the axis as the helix rotates.
- **search:** Cas9 hops between decoy sites; each PAM flashes red as it lands.
- **match:** scroll unzips the helix and twenty rungs light in sequence; an aside shows the near-match stalling.
- **cut:** the helix snaps, a shockwave ripples the glass, then stillness.
- **repair:** the ends rejoin out of register and one section dims: the switch is off.
- **beyond:** one rung changes colour in place without the strand breaking.
