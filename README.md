# own-it

Use AI to write code you actually own: you can map the system it touches, explain every chunk, and defend every tradeoff.

own-it flips the usual roles in Claude Code. **You** map the code, plan each step, predict what will happen and explain the result. **Claude** types exactly what you asked, runs it, and tutors you with questions. Hooks enforce the loop, so it holds at 11pm too.

It's slower than letting Claude drive, on purpose. The goal is the right level of abstraction for AI-assisted coding: the AI does the typing and the lookups, and you do the thinking that makes you a better developer.

## The loop

```
recon ─► plan ─► execute ◄──────────┐ ─► review ─► explain ─► done (commit)
 map      steps   step N: Claude types │    rubric    teach-back
                  you predict ─► run   │    score     every chunk
                  you diagnose ────────┘    ◄── loop if any score < 3
```

| Phase | You | Claude |
|---|---|---|
| **recon** | Map only what the change touches: entry, path, blast radius, data, safety net | Answers your questions about the code and quizzes your map. Never suggests the fix |
| **plan** | Write the steps, each with the files it may change | Asks how you'll know each step worked |
| **execute** | Predict what a run will do, read the failure, propose the next step | Implements your step literally, even if it's wrong. Stays silent and lets the run show it |
| **review** | Answer the probe questions and fix what scored under 3 | Scores the diff against your rubric. Asks questions, never hands you fixes |
| **explain** | Explain each chunk: what, why, one alternative | Shows each chunk and writes down your answers in your words |
| **done** | Commit and open the PR | Drafts the PR description from your own notes |

Along the way you write **questions** the moment something is unclear, and close them yourself as **answered** (tagged by how you found out: `read`, `ran` or `told`) or **obsolete** (with a reason). A lot of `told` answers means you're leaning on Claude.

When a step keeps failing, help unlocks gradually: after 3 failed runs Claude may ask a pointed question, then name the file and line, and finally explain the cause.

## What's enforced

The rules are hooks, not just instructions. Claude can't drift past them, and neither can you without leaving a trace.

| Rule | How |
|---|---|
| Code changes only in execute, only in the current step's files | `PreToolUse` guard on Edit and Write. Shell writes (`sed -i`, `>`, `tee`, `git apply`) are denied, so changes can't route around it |
| Phase changes and predictions are yours | `own-it next`, `back`, `step`, `skip`, `off` and `predict` ask you first |
| Every check runs against a prediction | In execute, test and run commands only go through `own-it run`, which needs a recorded prediction |
| Your files hold your words | Claude's writes to map, plan, questions and decisions ask you first |
| No commit until review passes and every chunk is explained | The guard denies `git commit` before the done phase |
| Your notes never get committed | `.own-it/` goes in the clone's `.git/info/exclude` (no `.gitignore` edit), and commits with it staged are denied |
| Irreversible commands get a second look | `rm -r`, `git reset --hard`, `git clean`, `git push` and `DROP TABLE` ask you |
| Skipping a gate is possible but never silent | `own-it skip "<reason>"` asks you, then logs the reason |

It's a guardrail for an honest Claude, not a sandbox: it catches the common ways to drift, not every possible one.

## Install

In Claude Code (listed in the [`amierlorenz/skills`](https://github.com/amierlorenz/skills) marketplace):

```
/plugin marketplace add amierlorenz/skills
/plugin install own-it@amierlorenz
/own-it setup            # copy the rubric so you can make it yours
```

Needs Claude Code 2.1.91 or later (for the plugin's `own-it` command), plus `git`, `jq` and `perl`. All three come with macOS and most Linux distros, except `jq` (`brew install jq` or `apt install jq`).

## Use

```
/own-it fix #42: crash when the title is empty
```

That starts recon in the repo you're in. From there:

- `/own-it` or `/own-it status` shows where you are and what the next gate needs.
- Tell Claude when you're ready to move on. It runs `own-it next`, and you approve it.
- `/own-it off` stops guarding the repo. Starting a new task archives the previous one to `.own-it/archive/`.

Your working files live in `.own-it/` at the repo root: `map.md`, `plan.md`, `questions.md`, `decisions.md`, plus `review.md` (Claude's scores) and `log.md` (every step, prediction and run). Edit them in your editor or dictate to Claude. The formats are in [`skills/own-it/references/files.md`](skills/own-it/references/files.md).

## The rubric

Review scores your change on 10 criteria from 1 to 4: correctness, scope, fit with the codebase, complexity, module depth, readability, errors, security, performance and ownership. The complexity and depth criteria come from John Ousterhout's *A Philosophy of Software Design*. Every criterion has to reach 3 ("mergeable, and you can explain every choice"). Anything below 3 sends you back to execute with that criterion's probe questions.

`/own-it setup` copies [`rubric.example.md`](rubric.example.md) to `~/.config/amierlorenz-skills/own-it.md`. Edit that copy: plugin updates never touch it.

## Display

A band above the prompt shows the phase, the step, your question counts and progress, plus what the next gate needs:

```
own-it execute · step 2 · my-app   ?1 ✓3 ~1   hint 1/3                questions   plan   review
  next: The last run must pass first. Predict, then: own-it run -- <check>
```

- **questions** lists your questions, open ones first, and how many answers were `told`.
- **plan** shows the current step, its files and your prediction.
- **review** shows the latest scores.

The **Task display** setting switches the band to a one-line `hint` under the prompt instead. Change it with `/plugin configure own-it@amierlorenz`.

The display uses Claude Code's early-access function hooks (`hooks/register.tsx`). The guard and the per-turn reminder are plain command hooks and work without it.

## Settings

- `OWN_IT_HINT_AFTER` (default `3`): how many failed runs on a step before hints unlock. Set it in the `env` of `~/.claude/settings.json`.

## Developing

- `bash hooks/own-it-guard.test.sh` runs the guard and the `own-it` command against throwaway repos.
- `claude plugin test .` runs the display's tests (`tests/`).
- `claude --plugin-dir .` loads your working copy.

## Uninstall

`/plugin uninstall own-it@amierlorenz`, then `rm -f ~/.config/amierlorenz-skills/own-it.md`. Each repo keeps its `.own-it/` folder until you delete it, along with the `/.own-it/` line in `.git/info/exclude`.

## License

[MIT](LICENSE)
