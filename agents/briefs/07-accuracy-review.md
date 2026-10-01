# Brief 07: accuracy review

The audience is healthcare professionals. One wrong number or one loosely worded mechanism discredits the whole site. You did not write any of it. Your job is to check every clinical and scientific statement, in words and in pictures, against primary sources. You change no code.

## You own

- `agents/reviews/07-accuracy.md`
- `agents/shots/07-accuracy/` (if you need screenshots)

## How

1. Read `src/content/scenes.js` and `index.html`: every large line, every piece of copy, every annotation, the `practice` section and the references.
2. Read the fact table in `agents/status/05-page.md`. Do not take it on trust. Open each source yourself (WebFetch, WebSearch) and confirm that the quoted support exists and actually supports the statement as worded on the page.
3. Check in particular:
   - The indication, ages, efficacy counts and percentages, and warnings against the current US prescribing information on DailyMed, including its revision date.
   - Approval dates against FDA announcements.
   - Trial figures against the published papers, and that each figure is attributed to the right population and time point.
   - The mechanism: what Cas9 recognises (PAM sequence and orientation), where it cuts, which domain cuts which strand, what kind of break results, how the break is repaired in this therapy, what is edited (the BCL11A erythroid enhancer, not the sickle mutation), and why that raises fetal hemoglobin.
   - Nomenclature for the sickle mutation.
   - Any statement that overstates: "cure", "corrects", "all patients", or a benefit without its denominator.
   - Balance: is the burden and risk stated as plainly as the benefit?
4. Check the pictures too. Take screenshots of the scenes (`npm run shot -- 07-accuracy/<name> "progress=<p>" --page`) and read `agents/status/01-helix.md` to `04-atmosphere.md`. Is the helix right-handed with unequal grooves? Does the cut happen at the stated position relative to the PAM? Do the visuals imply anything false (for example, an existing sickled cell turning round, or the edit happening inside a red cell, which has no nucleus)? Schematic simplification is acceptable where the references section says so; a false implication is not.
5. Check that every reference is real, correctly cited and resolves, and that the disclaimer is present.

## Output

`agents/reviews/07-accuracy.md` in the review format from `agents/README.md`: a short verdict, then findings ranked most serious first, each with an id (`A-01` …), severity, where it appears, the owning agent, the exact text on the page, the exact quote from the source, and the corrected wording you recommend. Also list the statements you verified and found correct, with their sources, so the record is complete.
