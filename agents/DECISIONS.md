# Decisions

Writer: coordinator. Newest first. Re-read this at the start of every round.

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
