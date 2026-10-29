#!/bin/bash
# Self-check for own-it-guard.sh and bin/own-it. Run: bash hooks/own-it-guard.test.sh
here=$(cd "$(dirname "$0")" && pwd)
H=$here/own-it-guard.sh O=$here/../bin/own-it fails=0
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; cd "$T" || exit 1
T=$(pwd -P)

repo() { # name: a repo with one commit
  mkdir -p "$1/src" && git -C "$1" init -q -b main
  printf 'def add(a, b):\n    return a - b\n' > "$1/src/calc.py"
  printf 'from src.calc import add\nassert add(2, 3) == 5\n' > "$1/test_calc.py"
  git -C "$1" add . && git -C "$1" commit -qm init
}
repo app; repo plain
(cd app && $O start "fix add" >/dev/null)

check() { # label, expected, actual
  [ "$3" = "$2" ] && s=PASS || { s=FAIL; fails=$((fails+1)); }
  printf '%s %-62s -> %s\n' $s "$1" "$3"
}
b() { # repo, command, expected
  out=$(jq -n --arg c "$2" --arg w "$T/$1" '{tool_name:"Bash",tool_input:{command:$c},cwd:$w}' | $H |
    jq -r '.hookSpecificOutput.permissionDecision'); check "$1 \$ $2" "$3" "${out:-none}"
}
e() { # repo, tool, path (relative to the repo), expected
  out=$(jq -n --arg t "$2" --arg p "$T/$1/$3" --arg w "$T/$1" '{tool_name:$t,tool_input:{file_path:$p},cwd:$w}' | $H |
    jq -r '.hookSpecificOutput.permissionDecision'); check "$1 $2 $3" "$4" "${out:-none}"
}
phase() { jq --arg p "$1" '.phase=$p' app/.own-it/state.json > s.tmp && mv s.tmp app/.own-it/state.json; }

# The clone's exclude file keeps .own-it out of git, without touching .gitignore.
check "start writes .git/info/exclude" yes "$(grep -qx '/.own-it/' app/.git/info/exclude && echo yes)"
check "start leaves git status clean" "" "$(git -C app status --short)"

# No task in progress: the guard stays out of the way.
e plain Edit src/calc.py none
b plain 'git commit -m x' none
b plain 'python3 test_calc.py' none

# recon
e app Edit src/calc.py deny
e app Write .own-it/state.json deny
e app Edit .own-it/map.md ask
e app Write .own-it/questions.md ask
e app Write .own-it/review.md none
b app 'grep -rn add src' none
b app 'python3 test_calc.py' none
b app "sed -i 's/-/+/' src/calc.py" deny
b app 'echo "return a + b" > src/calc.py' deny
b app 'cat > src/new.py <<EOF
x = 1
EOF' deny
b app 'echo "a > b" && ls 2>&1 >/dev/null' none
b app "jq '.phase=\"done\"' .own-it/state.json > /tmp/s && mv /tmp/s .own-it/state.json" deny
b app 'own-it status' none
b app 'own-it next' ask
b app "\"/x/bin/own-it\" skip \"plan was obvious\"" ask
b app 'own-it start "other task"' none
b app 'git commit -m "fix: add"' deny
b app 'rm -rf build' ask
b app 'git reset --hard' ask

# execute, step 1 allows src/calc.py
phase execute; jq '.step=1 | .files=["src/calc.py", "tests/"]' app/.own-it/state.json > s.tmp && mv s.tmp app/.own-it/state.json
e app Edit src/calc.py none
e app Write tests/new/test_more.py none
e app Edit test_calc.py deny
b app 'python3 test_calc.py' deny
b app 'cd src && python3 -c "import calc"' deny
b app 'npm install' none
b app 'own-it predict "assertion error"' ask
b app 'own-it run -- python3 test_calc.py' none

# done: commits go through, but never with .own-it staged
phase done
b app 'git add src/calc.py' none
b app 'git commit -m "fix: add"' none
b app 'git add -f .own-it/plan.md' deny
git -C app add -f .own-it/plan.md
b app 'git commit -m "fix: add"' deny
git -C app restore --staged .own-it/plan.md

# off: back to normal
phase off
e app Edit test_calc.py none
b app 'git commit -m x' none

# The CLI: gates hold until the user's files are filled in.
(cd plain && $O start "t" >/dev/null)
check "next blocked by an empty map" 1 "$(cd plain && $O next >/dev/null 2>&1; echo $?)"
check "run without a prediction" 1 "$(cd plain && $O run -- true >/dev/null 2>&1; echo $?)"
for s in Entry Path "Blast radius" Data "Safety net"; do printf '## %s\nx\n' "$s"; done > plain/.own-it/map.md
check "next with a full map" 0 "$(cd plain && $O next >/dev/null 2>&1; echo $?)"
check "next blocked by the plan's example" 1 "$(cd plain && $O next >/dev/null 2>&1; echo $?)"
check "questions template counts as no questions" 0 "$(cd plain && $O status --json | jq '.questions | length')"
printf '## Step 1: fix\nFiles: src/calc.py\n' >> plain/.own-it/plan.md
check "next with a step" 0 "$(cd plain && $O next >/dev/null 2>&1; echo $?)"
check "step files loaded" '["src/calc.py"]' "$(jq -c .files plain/.own-it/state.json)"
check "skip needs a reason" 1 "$(cd plain && $O skip >/dev/null 2>&1; echo $?)"

echo "failures: $fails"
[ $fails -eq 0 ]
