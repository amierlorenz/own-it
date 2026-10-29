#!/bin/bash
# UserPromptSubmit hook. In a repo with an own-it task in progress, reminds Claude every turn of the phase
# and its one job there, so the roles hold over a long session. Prints nothing elsewhere.

input=$(cat)
cwd=$(jq -r '.cwd // empty' <<<"$input")
OWNIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/bin/own-it"
s=$("$OWNIT" -C "${cwd:-.}" status --json 2>/dev/null) || exit 0

field() { jq -r "$1" <<<"$s"; }
phase=$(field .phase) step=$(field .step) files=$(field '.files | join(", ")')
open=$(field '[.questions[] | select(.state == "open")] | length')
hint=$(field .hint) fails=$(field .fails)

head="own-it is on (task: $(field .task)). Phase: $phase. You are the user's hands and tutor; they think, decide and explain. $open open question(s) in .own-it/questions.md: only the user closes them. Before anything irreversible, say in one line what it destroys."
case $phase in
  recon) job="The user is mapping only what this change touches in .own-it/map.md (Entry, Path, Blast radius, Data, Safety net). Answer their questions about the code. Don't propose a plan or a fix. Quiz them on gaps in those five sections, nothing outside the change." ;;
  plan) job="The user writes the steps in .own-it/plan.md. Don't suggest steps. Ask questions that expose gaps, like how they'll know a step worked." ;;
  execute)
    case $hint in
      0) h="No hints yet ($fails failed run(s)): after a run, ask what they think happened. Questions only." ;;
      1) h="Hint level 1: ask one question that points toward the cause." ;;
      2) h="Hint level 2: point to the file and line where the cause is, without explaining it." ;;
      *) h="Hint level 3: explain the cause, then ask them to propose the next step." ;;
    esac
    job="Step $step: $(field .stepTitle). Files: $files. Implement exactly what the user asked for this step, nothing more, even if you think it's wrong: let the run show it. Before any check, ask for their prediction, record it with own-it predict, then own-it run -- <command>. $h" ;;
  review) job="Score the change against the rubric at $(field .rubric). Write .own-it/review.md as a table (| Criterion | Score | Note |) and a last line 'Result: pass' or 'Result: loop'. Ask the rubric's probe questions; don't give fixes. Pass only if every criterion is 3+ (N/A allowed for performance) and no hard fail." ;;
  explain) job="Teach-back: $(field .chunks.done) of $(field .chunks.total) chunks explained. Show the next unexplained chunk from .own-it/decisions.md (own-it chunks lists them), ask what it does, why this way and one alternative, then write their answer there in their words. Don't answer for them." ;;
  done) job="Ready to commit. Offer the answered questions for the PR's open questions section." ;;
esac

jq -n --arg c "$head $job" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$c}}'
