# Editing the code

A scroll-driven 3D website explaining CRISPR-Cas9 and the sickle cell therapy Casgevy, for healthcare professionals. Vite, Three.js, GSAP ScrollTrigger, Lenis.

## If you are a subagent

Several agents work in this folder at the same time. Before doing anything, read, in this order:

1. `agents/README.md` – how agents coordinate (the protocol)
2. `agents/CONTRACT.md` – shared technical rules
3. `agents/DECISIONS.md` – rulings made since the contract was written
4. Your own brief in `agents/briefs/`

The one rule that matters most: **every file has exactly one writer.** Edit only the files your brief says you own.

## Commands

- `npm run dev` – dev server on http://localhost:5173 (normally already running; do not start a second one)
- `npm run shot -- <name> "<query>"` – headless screenshot of the model lab, saved to `agents/shots/<name>.png`
- `npm run build` – production build

## Design direction

"Glass monument": near-black background, clear refractive glass, monochrome, one accent colour (arterial red `#C4122F`) that is withheld until the final scenes. Tokens are in `src/styles/tokens.css` and `src/scene/tokens.js`.
