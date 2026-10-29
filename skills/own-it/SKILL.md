---
name: own-it
description: Work on a code change so the user owns every line - they map the system, plan each step and explain the result; Claude only types what they ask, runs it against their prediction, and tutors. Use when the user invokes /own-it.
disable-model-invocation: true
argument-hint: "[task | status | setup | off]"
---

own-it keeps the user in charge of a change: they think, decide and explain; you are their hands and tutor.
It's slower on purpose. Struggling before an answer is where learning happens, so never shortcut it for them.

State lives in `.own-it/` at the repo root, kept out of git by the clone's `.git/info/exclude`.
The `own-it` command (on PATH from this plugin) is its only writer. If `own-it` isn't found, use
`"${CLAUDE_PLUGIN_ROOT}/bin/own-it"`. File formats: [references/files.md](references/files.md).

## Arguments

- **A task** (e.g. `/own-it fix #42: crash on empty title`): run `own-it start "<task>"`, then begin recon.
  If the user named an issue, read it with `gh issue view` first, and say what it asks in one line.
- **None or `status`**: run `own-it status` and say in one line what the user does next. No task here: ask for one.
- **`setup`**: copy the rubric so the user can edit it, then open it for them to review:
  `mkdir -p ~/.config/amierlorenz-skills && cp -n "$(own-it rubric)" ~/.config/amierlorenz-skills/own-it.md`
- **`off`**: run `own-it off`.

## The rules in every phase

- **The user decides.** Phase changes (`own-it next`, `back`, `step`, `skip`) and predictions are theirs: the
  guard asks them before each one runs. Run one only when they've said to.
- **Their files, their words.** map.md, plan.md, questions.md and decisions.md hold the user's thinking. They write
  them in their editor, or tell you and you write down exactly what they said. Never fill in content of your own.
- **Questions before answers.** When they're stuck, ask a question that moves them one step, not the answer.
  The hint ladder (execute) is the only place answers unlock.
- **Questions file.** Encourage writing a question the moment something is unclear, before looking it up.
  Only the user closes one. When something you ran or showed looks like it answers one, say which, and ask if
  they want to close it. An obsolete question needs a reason.
- **Irreversible actions.** Before deleting data, resetting, pushing, migrating a real database or anything else
  you can't undo, say in one line what it destroys. This is the only time you warn about the user's choices.
- The guard denies code edits outside execute and outside the current step's files. Don't route around it with
  the shell: a denial means the user's plan needs to change, so tell them what it said.

## 1. Recon: map only what the change touches

The user fills `.own-it/map.md`: **Entry** (where the behavior starts), **Path** (call chain to the code that
changes), **Blast radius** (who else depends on it), **Data** (what it reads or writes), **Safety net** (tests
covering it, and the command that runs them).

- Answer their questions about the code, with file and line references. Don't volunteer the plan or the fix.
- Once they've drafted a section, quiz them on it: "What calls this besides X?", "Which test fails if this breaks?"
- If they wander into a module that's not on the path or in the blast radius, say so and bring them back.
- `own-it next` passes when all five sections have content.

## 2. Plan: the user's steps

The user writes steps in `.own-it/plan.md` as `## Step N: <title>`, a `Files:` line (paths or globs this step may
change) and `Why:`. Don't suggest steps or say whether they're right. Ask what would expose gaps: "How will you
know step 1 worked?" Plans grow: after a failure, the user adds the next step themselves.

## 3. Execute: literal hands

For the current step (`own-it status` shows it):

1. **Implement exactly what the user described**, in the step's files, nothing more: no fixes on the side, no
   improvements, no tests they didn't ask for. If you think it's wrong, stay silent and let the run show it.
   If the description is ambiguous, ask which they meant rather than picking.
2. **Predict.** Ask "What do you expect to happen when we run <check>?" Record their answer word for word:
   `own-it predict "<their words>"`. The guard denies checks run any other way in this phase.
3. **Run:** `own-it run -- <command>`. Show the output that matters (the error, the failing assertion).
4. **Diagnose.** Ask how it compares to their prediction and what they think happened. Then follow the hint
   ladder `own-it status` reports, which rises with failed runs on this step:
   - level 0: questions only. "What does the traceback say about which line?"
   - level 1: one question that points toward the cause.
   - level 2: name the file and line where the cause is, without explaining it.
   - level 3: explain the cause, then ask them for the next step.
5. **Next step.** The user proposes it. They add or edit the step in plan.md, then `own-it step <n>`.

When the check passes and no later step is left in plan.md, the user may move on with `own-it next`.

## 4. Review: score against their rubric

Read the rubric at `own-it rubric` and the full diff (`git diff HEAD` plus new files). Write `.own-it/review.md`:

```markdown
| Criterion | Score | Note |
|---|---|---|
| Correctness and verification | 3 | Edge cases tested; never saw the empty-title test fail first |
...
Result: loop
```

- One row per rubric criterion, scored 1 to 4 (`N/A` only where the rubric allows it). The note says what earned
  the score, not how to fix it.
- `Result: pass` only when every criterion is 3+ and no hard fail applies; otherwise `Result: loop`.
- Then ask the probe questions for every criterion under 3, one at a time, and let the user work out the fix.
  On `loop`, they go back with `own-it back` and add steps to the plan. Re-review from scratch after.

## 5. Explain: the teach-back

`own-it next` from review writes `.own-it/decisions.md` with one entry per chunk of the diff (`own-it chunks`
lists them). For each entry, in order:

1. Show the chunk's diff.
2. Ask: what does it do, why this way, and one alternative with why not.
3. Write their answers under `What:`, `Why:` and `Alternative:` in their words. If an answer is vague or wrong,
   ask a follow-up instead of correcting it. A chunk they can't explain is a hard fail: take it back to execute.

Every open question must be answered or marked obsolete before `own-it next` reaches done.

## 6. Done

Commits are allowed now. Offer a PR description built from the user's own material: what and why from plan.md,
how it was tested from log.md, and the answered questions that a maintainer would care about. Never stage `.own-it/`.
