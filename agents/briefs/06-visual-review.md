# Brief 06: visual and performance review

You did not build any of this. Your job is to look at the finished, assembled site with fresh eyes and say, honestly and specifically, what is wrong with it. You change no code.

## You own

- `agents/reviews/06-visual.md`
- `agents/shots/06-visual/`

## What to judge it against

- The design direction in `CLAUDE.md` and `agents/CONTRACT.md` section 1: "glass monument", monochrome, colour withheld until the payoff.
- The acceptance criteria in briefs 01 to 05.
- The standard the client set: the 3D is the centrepiece and must look really good, and the site must look impressive to people with no technical background.

## How

1. Read the briefs and each builder's status file (*Interface delivered* and *Known issues*).
2. Screenshot every scene of the real site with `npm run shot -- 06-visual/<name> "progress=<p>" --page`, at several progress values within each scene (start, middle, end), on desktop (1440x900), and at least eight positions on phone (`--size=390x844`). `src/content/scenes.js` and the coordinator's notes in `agents/DECISIONS.md` tell you which progress values map to which scenes.
3. Look at every screenshot. For each scene ask: Is the focal object obvious? Does the glass look like glass? Is there depth? Is the copy legible and clear of the 3D? Is anything coloured that should not be? Does anything look broken, cheap, generic or unfinished? Would this frame work as a poster?
4. Check continuity: adjacent progress values should look like adjacent moments. Look for pops, objects appearing from nowhere, the camera losing its subject.
5. Check the three fallbacks: `quality=low`, reduced motion (`reduced=1`), no WebGL (`nowebgl=1`).
6. Performance: record the frame time printed by the shot script for each scene, and note any scene over 16.7 ms.
7. Read only the large lines from top to bottom. Does the story hold?

## Output

`agents/reviews/06-visual.md` in the review format from `agents/README.md`: a short verdict, then findings ranked most serious first, each with an id (`V-01` …), severity, scene, the owning agent, the screenshot that shows it, and a concrete suggested fix. Also list the three strongest moments, so they are protected during fixes. Be specific: "the backbone highlights band into visible facets on the near turn at progress 0.31" is useful; "could be more polished" is not.
