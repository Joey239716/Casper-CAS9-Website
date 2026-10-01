# Agent protocol

Seven agents and one coordinator (the main session) work on this project. All coordination happens through the markdown files in this folder. There is no other channel between agents.

## The rule

**Every file has exactly one writer.** You never edit another agent's code, another agent's status file, or any shared file. That is what lets several agents work at once without overwriting each other.

## The files

```
agents/
  README.md            this protocol                         writer: coordinator
  CONTRACT.md          shared technical rules                writer: coordinator
  DECISIONS.md         answers and rulings, newest first     writer: coordinator
  briefs/NN-name.md    one brief per agent                   writer: coordinator
  status/NN-name.md    one status file per builder           writer: that agent only
  reviews/06-visual.md, 07-accuracy.md   findings            writer: that reviewer only
  reviews/FIXES.md     what was done about each finding      writer: coordinator
  shots/NN-name/       your screenshots                      writer: that agent only
```

## The agents

| No. | Name | Phase | Brief |
|---|---|---|---|
| 01 | helix | 1, build | `briefs/01-helix.md` |
| 02 | cas9 | 1, build | `briefs/02-cas9.md` |
| 03 | cells | 1, build | `briefs/03-cells.md` |
| 04 | atmosphere | 1, build | `briefs/04-atmosphere.md` |
| 05 | page | 1, build | `briefs/05-page.md` |
| 06 | visual review | 3, review | `briefs/06-visual-review.md` |
| 07 | accuracy review | 3, review | `briefs/07-accuracy-review.md` |

## What you do

1. **On start**, read `README.md`, `CONTRACT.md`, `DECISIONS.md`, then your brief.
2. **Write only what you own**: the code files listed in your brief, your status (or review) file, and your `shots/` folder.
3. **Work in rounds.** A round is: change something, take screenshots, open the screenshots and look at them, write down what is wrong, decide the next change. Builders of 3D models do at least five rounds.
4. **At the start of every round**, re-read `DECISIONS.md` and skim `CONTRACT.md`. They can change while you work.
5. **At the end of every round**, update your status file (format below).
6. **If you need something you do not own** (a change to a shared material, an anchor from another model, a new dependency), write it under *Requests* in your status file with an id, and carry on with whatever is not blocked. Set `Status: blocked` only if nothing else can move. The coordinator answers in `DECISIONS.md`.
7. **You may read** other agents' status files. Rely only on their *Interface delivered* section; everything else there is work in progress.
8. **When finished**, set `Status: done`, make sure *Interface delivered* is exact, and list a final screenshot for every pose.

## What you do not do

- Do not edit files you do not own, including `package.json`, `vite.config.js`, anything in `src/scene/` that is not yours, `src/main.js`, `src/lab.js` and `scripts/shot.mjs`.
- Do not run git commands that change the repository (commit, add, checkout, stash, reset). The coordinator commits.
- Do not start a second dev server on port 5173, and do not stop the one that is running.
- Do not spawn further subagents.
- Do not install packages unless your brief says you may.

## Status file format

Keep the three header lines exactly as shown so they can be scanned.

```markdown
# Status: 01-helix

Status: working            <- working | blocked | done
Round: 3
Updated: 2026-10-01 15:20  <- run `date "+%Y-%m-%d %H:%M"`

## Summary
Two or three sentences: where things stand.

## Interface delivered
Exactly what the model exposes right now: params (name, range, what it does),
anchors, views, natural size, anything the choreography must know.
The coordinator writes the scroll timeline from this section alone.

## Iteration log
### Round 3
- Changed: ...
- Screenshots: agents/shots/01-helix/r3-unzip.png, ...
- Critique: what still looks wrong, judged against the acceptance criteria.
(newest round first)

## Requests
- R-01-1 (open): what you need, from whom, and why.
- R-01-2 (answered in DECISIONS.md): ...

## Known issues
Anything unfinished or fragile that the coordinator should know about.
```

## Review file format (agents 06 and 07)

```markdown
# Review: 06-visual

Status: working | done
Updated: 2026-10-01 18:00

## Verdict
Three or four sentences on the overall state.

## Findings
### V-01  [high]  Scene: cut  Owner: 01-helix
- What: ...
- Evidence: agents/shots/06-visual/cut-desktop.png (or a quoted source)
- Suggested fix: ...
```

Severity is `high` (breaks the story, looks broken, or is factually wrong), `medium` (noticeably weakens it) or `low` (polish). Ids are `V-nn` for visual, `A-nn` for accuracy.
