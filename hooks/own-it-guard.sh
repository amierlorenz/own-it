#!/bin/bash
# PreToolUse hook (matchers: Edit|Write|MultiEdit|NotebookEdit, Bash). Active only in a repo with a task in
# progress (.own-it/state.json, phase not "off"). Prints nothing for calls it leaves to normal permissions.
#
# - Code changes: only in execute, only to the current step's files.
# - .own-it/state.json: only through the own-it command. The user's own files (map, plan, questions,
#   decisions) need their yes, so what's written there is theirs.
# - own-it commands that move a phase or record a prediction need the user's yes.
# - In execute, checks run through `own-it run`, after a prediction.
# - Commits wait for phase done and never include .own-it/. Irreversible commands ask.
# A guardrail for an honest Claude, not a sandbox: it catches the common ways to drift, not every one.

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")

decide() { # $1 = allow|ask|deny, $2 = reason
  jq -n --arg d "$1" --arg r "own-it: $2" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  exit 0
}

session() { # $1 = dir; sets root, phase, step, files (newline separated); fails when no task is in progress
  root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  local s=$root/.own-it/state.json
  [ -f "$s" ] || return 1
  phase=$(jq -r '.phase' "$s") step=$(jq -r '.step' "$s") files=$(jq -r '.files[]?' "$s")
  [ "$phase" != off ]
}

# ---------- file edits ----------
if [ "$tool" != Bash ]; then
  path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
  [ -n "$path" ] || exit 0
  [[ $path == /* ]] || path=$cwd/$path
  # Relative to the repo root, through the nearest existing directory (a new file's folder may not exist yet,
  # and macOS /tmp is really /private/tmp).
  d=$(dirname "$path") rest=$(basename "$path")
  while [ ! -d "$d" ]; do rest=$(basename "$d")/$rest; d=$(dirname "$d"); done
  d=$(cd "$d" && pwd -P)
  session "$d" || exit 0
  rel=$d/$rest; rel=${rel#"$root"/}

  case $rel in
    .own-it/state.json) decide deny "state.json changes only through the own-it command." ;;
    .own-it/map.md | .own-it/plan.md | .own-it/questions.md | .own-it/decisions.md)
      decide ask "${rel#.own-it/} is the user's file. Check it says what you said, in your words." ;;
    .own-it/*) exit 0 ;;
  esac
  [ "$phase" = execute ] ||
    decide deny "phase is $phase. Code changes happen only in execute, one step of the user's plan at a time."
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    # shellcheck disable=SC2053 # a Files: entry may be a glob
    [[ $rel == $f || $rel == ${f%/}/* ]] && exit 0
  done <<<"$files"
  decide deny "$rel isn't in step $step's files ($(tr '\n' ' ' <<<"$files" | sed 's/ $//; s/ /, /g')). If it needs to change, the user adds it to the step in plan.md and runs: own-it step $step"
fi

# ---------- Bash ----------
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
[ -n "$cmd" ] || exit 0

# A command word: at line start or after a separator, optionally behind `env ...` / `VAR=x`.
P='(^|[;&|(][[:space:]]*)(env( -u [A-Za-z_]+| [A-Za-z_]+=[^ ]*)* )?([A-Za-z_]+=[^ ]* )*'
C=" -C (\"[^\"]*\"|'[^']*'|[^ ]+)"

# Quoted text and heredoc bodies can't run or write anything: blank them before looking for operators.
code=$(perl -0777 -pe 's/<<-?\s*([\x27"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\s*(\n|$)/<<HEREDOC\n/gs;
  s/\x27[^\x27]*\x27|"(?:[^"\\]|\\.)*"/""/g' <<<"$cmd")

# The own-it command itself (bare, or by path). Transitions and predictions are the user's call.
OWNIT="${P}(\"?[^ ;&|]*/)?own-it\"? "
if [[ $cmd =~ ${OWNIT}(-C [^ ]+ )?(next|back|step|skip|off|predict) ]]; then
  sub=${BASH_REMATCH[${#BASH_REMATCH[@]}-1]}
  case $sub in
    predict) decide ask "is this the user's prediction, in their words? $(grep -oE 'predict .*' <<<"$cmd" | cut -c9- | head -c 200)" ;;
    skip) decide ask "skipping a gate. It's logged with the reason." ;;
    off) decide ask "turning own-it off for this repo." ;;
    *) decide ask "own-it $sub moves the task along. That's the user's call." ;;
  esac
fi

dir=$cwd
re_cd="^[[:space:]]*cd[[:space:]]+(\"[^\"]*\"|'[^']*'|[^ ;&|]+)[[:space:]]*&&"
if [[ $cmd =~ $re_cd ]]; then
  d=${BASH_REMATCH[1]}; d=${d#[\"\']}; d=${d%[\"\']}
  [[ $d == "~"* ]] && d=$HOME${d:1}
  [[ $d == /* ]] || d=$cwd/$d
  [ -d "$d" ] && dir=$d
fi
session "$dir" || exit 0

grep -qE '\.own-it/state\.json' <<<"$cmd" && grep -qE '>|sed -i|perl -[a-z]*i|tee |mv |cp |rm |truncate|jq .*>' <<<"$cmd" &&
  decide deny "state.json changes only through the own-it command."

# Commits: never the .own-it folder, and only once the task is done.
if grep -qE "${P}git(${C})? add\b.*(-f|--force)" <<<"$code" && grep -q '\.own-it' <<<"$cmd"; then
  decide deny ".own-it/ is the user's learning record and is never committed."
fi
if grep -qE "${P}git(${C})? commit([^[:alnum:]_-]|\$)" <<<"$code"; then
  git -C "$root" diff --cached --name-only | grep -q '^\.own-it/' &&
    decide deny ".own-it/ is staged. Unstage it: git restore --staged .own-it"
  [ "$phase" = done ] ||
    decide deny "phase is $phase. Commits wait for review and the teach-back (own-it status shows what's left)."
fi

# Irreversible: Claude says so in one line first, and the user decides.
grep -qE "${P}(rm -[a-zA-Z]*[rR]|git(${C})? (reset --hard|clean -[a-z]*f|push|checkout -- \.|restore \.))|DROP (TABLE|DATABASE|SCHEMA)|TRUNCATE " <<<"$code" &&
  decide ask "this can't be undone. Did Claude say what it destroys before running it?"

# Files change through Edit and Write, so the step's file list applies.
writes=$(grep -oE "(^|[^0-9&<>=])>>?[[:space:]]*[^[:space:]&|;)>]+" <<<"$code" | sed -E 's/^[^>]*>>?[[:space:]]*//' |
  grep -vE '^(/dev/(null|stdout|stderr|tty)|/tmp/|\$TMPDIR|\.own-it/|"?\$\{?T|&)')
[ -n "$writes" ] && decide deny "writes $(head -1 <<<"$writes") from the shell. Change files with Edit or Write, so the step's file list applies."
grep -qE "${P}(sed -[a-zA-Z]*i|perl -[a-zA-Z]*i|tee [^-]|git(${C})? apply|patch )" <<<"$code" &&
  decide deny "edits files from the shell. Change files with Edit or Write, so the step's file list applies."

# Execute: every check runs against a prediction.
if [ "$phase" = execute ]; then
  RUN='(pytest|python[0-9.]*|py|node|deno|bun|npm|pnpm|yarn|npx|cargo|go|make|just|mvn|gradle|\./gradlew|dotnet|ruby|rake|rspec|bundle|php|phpunit|java|mix|elixir|swift|jest|vitest|tox|nox|uv|uvx|poetry|ctest|zig|\./[^ ]+)'
  SETUP=' (i|install|add|ci|sync|fetch|mod|get|lock|remove|uninstall|-m pip|--version|-V)( |$)'
  if grep -qE "${P}${RUN}( |\$)" <<<"$code" && ! grep -qE "${P}${RUN}${SETUP}" <<<"$code"; then
    decide deny "checks run against a prediction. Ask the user what they expect to happen, record it with own-it predict \"<their words>\", then: own-it run -- <command>"
  fi
fi
exit 0
