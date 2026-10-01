# Technical contract

Writer: coordinator. Read-only for agents. If something here stops you doing good work, say so under *Requests* in your status file.

## 1. The site in one paragraph

One fixed full-screen WebGL canvas sits behind ordinary scrolling HTML sections. Scroll position scrubs one GSAP timeline that moves a camera and sets numeric parameters on a handful of 3D models. The viewer follows the Cas9–guide RNA complex along a glass DNA helix. Thirteen scenes, in order:

`title, problem, spare, library, reader, search, match, cut, repair, payoff, practice, beyond, references`

The full scene descriptions are in each brief. The look is "glass monument": near-black field, clear glass, monochrome. The only colour is arterial red, and it is withheld: a thin red thread (the guide RNA) from scene `reader` onward, then a screen full of red cells in `payoff`. Nothing else may be coloured.

## 2. File ownership

| Files | Owner |
|---|---|
| `src/scene/helix.js` | 01-helix |
| `src/scene/cas9.js`, `scripts/build-cas9.mjs`, `public/models/cas9.*` | 02-cas9 |
| `src/scene/cells.js` | 03-cells |
| `src/scene/nucleus.js`, `src/scene/letters.js`, `src/scene/post.js` | 04-atmosphere |
| `index.html`, `src/styles/main.css`, `src/content/scenes.js`, `src/scroll/annotations.js`, `src/scroll/progress.js` | 05-page |
| Everything else (`src/main.js`, `src/lab.js`, `lab.html`, `src/scene/context.js`, `materials.js`, `environment.js`, `tokens.js`, `src/styles/tokens.css`, `src/scroll/timeline.js`, `src/scroll/cameraPath.js`, `scripts/shot.mjs`, `package.json`, `vite.config.js`, `agents/*.md` except your own status) | coordinator |

You may add private helper files next to your own, prefixed with your model name (for example `src/scene/helix.shaders.js`). List them in your status file.

## 3. Model module interface

Every 3D model is one ES module with this shape. The placeholder files in `src/scene/` show it.

```js
import * as THREE from 'three';

export const meta = {
  name: 'helix',
  // Every tunable number, with its default and a one-line description.
  params: {
    unzip: { value: 0, doc: '0..1. Opens the 20-bp bubble at the target site.' },
  },
  // Named camera set-ups for the lab. 'hero' is required.
  views: {
    hero: { pos: [9, 2, 26], look: [0, 0, 0], fov: 35 },
  },
};

// May be async (the lab and the site both await it).
export function create(ctx) {
  const group = new THREE.Group();
  const params = { unzip: 0 };           // live object; the timeline tweens these numbers
  const anchors = { target: someObject3D }; // Object3D (moves with the model) or Vector3 (local)
  return {
    group,
    params,
    anchors,
    update(time, dt) { /* read params, pose the model */ },
    dispose() { /* free geometries, textures, materials you created */ },
  };
}
```

Rules:

- **The model is a pure function of `(params, time)`.** The timeline is scrubbed forwards and backwards and jumped to arbitrary points, so `update` must produce the same picture for the same `params` and `time` no matter what came before. No accumulated state, no one-shot triggers, no `+=` on positions. `time` is only for gentle idle motion (drift, slow rotation) and must never be needed to complete a pose.
- **Params are numbers**, normally 0 to 1, and every intermediate value must look good, because the viewer can stop scrolling anywhere.
- **Params must combine sensibly** unless your brief says two are exclusive.
- `ctx` gives you `{ renderer, scene, camera, keyLight, materials, tokens, quality, size }`. Do not add things to `ctx.scene` yourself; put everything in your `group`. Do not move the camera.
- Do not create lights. Lighting is the shared environment map plus one key light.
- `ctx.quality` is `'high'` or `'low'`. On `'low'` (phones) roughly halve instance counts and segment counts. The shared glass already drops transmission on `'low'`.
- Clean up in `dispose`.

## 4. Units and orientation

- **Molecular models (helix, cas9, letters, the chromatin part of nucleus): 1 unit = 1 nanometre.** B-DNA is 2 units across and rises 0.34 units per base pair.
- **The helix axis is the model's local +Y axis, and the centre of the 20-bp target site is the helix's local origin.** Cas9 uses the same convention: its local origin is the centre of its DNA channel and DNA passes through it along local +Y. Putting both groups at the same position and rotation must dock them correctly.
- **Cells: 1 unit = 1 micrometre.** A red cell is about 7.8 units across.
- The coordinator positions, rotates and scales each model's `group` in the final scene. Build your model around its own origin and do not assume a world position.
- Default camera: perspective, 35° vertical field of view.

## 5. Shared materials (`ctx.materials`)

| Name | What it is | Use for |
|---|---|---|
| `glass` | Clear refractive glass with dispersion (`MeshPhysicalMaterial`, transmission) | Backbones, Cas9, clear cells. Use sparingly: a few large meshes or one instanced mesh. |
| `frost` | Opaque frosted glass, cheap | Base-pair rungs, chromatin, anything in the thousands |
| `frostDim` | Darker frost | Switched-off or receding structure |
| `arterial` | Glossy opaque blood red | Red cells in the payoff |
| `guide` | Self-lit red, picked up by bloom | Guide RNA, PAM flash, lit rungs |

- Never mutate a shared material. If you need a variant (opacity, emissive level, an `onBeforeCompile` vertex effect), `clone()` it, and dispose the clone.
- Clear glass does not refract other clear glass (a WebGL limit): transmissive objects only see opaque objects and the backdrop behind them. Design with that in mind.
- If the shared glass itself looks wrong for your model, do not work around it privately. Raise a request so every model changes together.
- Colours come from `ctx.tokens` (`darkfield`, `deepField`, `glass`, `frost`, `arterial`). No other hues.

## 6. The model lab

`http://localhost:5173/lab.html` shows models alone under the site's real lighting.

| Query | Meaning |
|---|---|
| `model=helix` or `model=helix,cas9` | Which models to load (`helix`, `cas9`, `cells`, `nucleus`, `letters`) |
| `unzip=0.5` | Set a param on the first model |
| `cas9.open=1` | Set a param on a named model |
| `cas9.pos=0,3,0` `cas9.rot=0,90,0` `cas9.scale=2` | Place a model's group (rotation in degrees) |
| `view=close` | Use a named view from the first model's `meta.views` (default `hero`) |
| `cam=3,1,9&look=0,0,0&fov=35` | Explicit camera |
| `time=2.5` | Freeze the clock at this time (also disables orbit controls). Use for repeatable shots. |
| `quality=low` | Phone quality |
| `post=1`, `post.bloom=1` | Run through `src/scene/post.js` and set its params |
| `anchors=1` | Draw a green dot at every anchor |
| `fog=0.02` | Fog density |

Without `time=`, the lab animates and you can orbit with the mouse. `window.__lab.models` holds the live models in the browser console.

## 7. Screenshots

```
npm run shot -- <name> "<query>" [<name> "<query>" ...] [--size=1440x900]
```

- Saves `agents/shots/<name>.png`. Use your own folder: `01-helix/r2-unzip-05`.
- Several name/query pairs in one command are faster than several commands.
- It freezes time at 0 unless you pass `time=`.
- It prints frame time, draw calls and triangle count, and any console errors (which make it exit non-zero).
- `--page` shoots the site instead of the lab: `npm run shot -- 05-page/library "progress=0.3" --page`. Add `--size=390x844` for a phone.
- **Open every screenshot with the Read tool and actually look at it.** A screenshot you did not look at does not count as a round.

Performance target: the finished site holds 60 fps (16.7 ms) on an Apple M2 laptop at 1440x900 with all models on screen. Each brief gives its model a budget.

## 8. Page ↔ engine interface (05-page and coordinator)

- `index.html` contains `<div id="stage-wrap"><canvas id="stage"></canvas></div>` (fixed, full viewport, behind content) and loads `/src/main.js` as a module.
- Each scene is `<section class="scene" id="scene-<id>" data-scene="<id>">`, in the order given in section 1.
- `src/content/scenes.js` exports `scenes` (array in order, each `{ id, line, copy, length, annotations }`, where `length` is the section height in viewport heights), plus `formatScale(metres)` and `formatCount(n)` for the two readouts.
- Readouts are elements with `data-readout="scale"` and `data-readout="count"`. `main.js` sets their `textContent`.
- Each entry in a scene's `annotations` array is `{ id, anchor, text }`: a unique id such as `search-pam`, an anchor name such as `helix.pam`, and the text.
- `index.html` contains one empty `<div data-annotations></div>` (fixed, full viewport, above the canvas, `pointer-events: none`) and one `<div data-progress></div>`.
- `src/scroll/annotations.js` exports `createAnnotations({ root, defs })`, where `root` is the `[data-annotations]` element and `defs` is every annotation with its scene id added (`{ id, anchor, text, scene }`). It returns `{ set(id, { x, y, alpha }), hideAll() }`. `main.js` projects each annotation's 3D anchor to CSS pixels from the viewport's top-left every frame and calls `set`; `alpha` 0 means hidden.
- `src/scroll/progress.js` exports `createProgress(el)`, where `el` is the `[data-progress]` element, returning `{ set(p) }` with `p` from 0 to 1 over the whole page.
- Test hooks handled by `main.js`: `?progress=0.3` jumps to that fraction of the page, `?reduced=1` forces reduced motion, `?nowebgl=1` forces the no-WebGL state, `?quality=low` forces phone quality.
- `main.js` adds classes to `<html>`: `webgl` or `no-webgl`, `reduced-motion` when the viewer asks for it, and `quality-low` on phones.
