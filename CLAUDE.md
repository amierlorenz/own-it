# own-it

A Claude Code plugin by Amier ([amierlorenz](https://github.com/amierlorenz)): a learning loop for AI-assisted
code changes, enforced by hooks. Listed in the [`amierlorenz/skills`](https://github.com/amierlorenz/skills) marketplace.

## Git workflow (pr mode)
<!-- git-workflow:pr — checked by the git-workflow plugin's guard hook; keep this marker -->
- Never commit to main, never merge a PR, never force-push. If a branch falls behind main, merge main into it.
- One branch per issue or feature: `feat/<issue#>-<slug>`, `fix/<issue#>-<slug>`.
- Conventional Commits 1.0.0, subject line only unless the why isn't obvious from the diff.
  Breaking changes: `!` after the type and a `BREAKING CHANGE:` footer.
- Run `git add` and `git commit -m "<subject>"` as separate commands, never chained.
- PR title is a conventional commit (it becomes the squash commit on main).
  Body: what, why, how tested, open questions, `Closes #N`.
- Review comments: fix what's clear, ask on the PR when ambiguous, reply to every thread.

## Layout
- `bin/own-it`: the state machine, and the only writer of `.own-it/state.json`. Gates live in its `gate()`.
- `hooks/own-it-guard.sh`: PreToolUse guard (Edit, Write, MultiEdit, NotebookEdit, Bash). Stable hooks API only.
- `hooks/own-it-context.sh`: UserPromptSubmit reminder of the phase and Claude's job in it.
- `hooks/register.tsx`, `hooks/display.ts`: the band (early-access function hooks). Must fail without affecting the guard.
- `skills/own-it/SKILL.md`: what Claude does in each phase. `rubric.example.md`: the default rubric.

## Checks
- Guard or CLI changes: a failing case in `hooks/own-it-guard.test.sh` first, then the fix;
  `bash hooks/own-it-guard.test.sh` must end with `failures: 0`.
- A new field in `own-it status --json` goes in `types/index.d.ts` too. A changed field gets a new `shape` tag on
  the `status` atom, with a test that the old value is declined.
- Display changes: `claude plugin test .` must pass.
- After touching `.claude-plugin/*.json` or `hooks/hooks.json`: `claude plugin validate .`, then install from a local
  marketplace copy and check that `claude plugin list` shows it enabled.
- Every change names its source in the PR: the Claude Code plugin or hooks docs, a learning-science source for
  loop changes, or a linked observed failure. No source: call it a proposal.

## Skill (`skills/own-it/SKILL.md`)
- Read on every run: keep a line only if the agent would act differently without it. Under 500 lines.
- The user decides, writes and explains; Claude types, runs and asks. A change that hands thinking back to Claude
  needs a reason in the PR.
- No personal paths, names or account details in examples.
- The user's rubric lives at `~/.config/amierlorenz-skills/own-it.md`; never write into the plugin folder.
