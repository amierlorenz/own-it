# .own-it/ files

All live at the repo root in `.own-it/`, listed in `.git/info/exclude`. Starting a new task moves the previous
task's files to `.own-it/archive/<date>/`, which keeps a record of what the user learned.

| File | Written by | Read by |
|---|---|---|
| `state.json` | `own-it` only | the guard, the band, `own-it status` |
| `map.md` | the user | recon gate |
| `plan.md` | the user | plan gate, `own-it step` |
| `questions.md` | the user | explain gate, the band |
| `log.md` | `own-it` (steps, predictions, runs, skips) | the PR description |
| `review.md` | Claude | review gate, the band |
| `decisions.md` | `own-it` writes the skeleton; the user's answers fill it | explain gate |

## plan.md

```markdown
## Step 2: return early when the title is empty
Files: src/posts/create.py, tests/test_create.py
Why: the crash happens before validation runs
```

`Files:` is comma-separated paths or globs (`src/posts/*.py`), or a folder ending in `/`.

## questions.md

```markdown
- [ ] why does create() validate after saving?
- [x] what calls create()? → the API route and the import script (read)
- [x] does the import script ever pass an empty title? → yes, for drafts (ran)
- [~] is the ORM caching the title? → the crash is before any query
```

The tag after an answer says how the user found it: `read` (the code), `ran` (it), `told` (Claude explained).
Many `told` answers mean the user is leaning on Claude: slow down.

## decisions.md

```markdown
### 1. src/posts/create.py @@ -12,6 +12,9 @@
What: returns a 400 before saving when the title is empty
Why: validation has to run before the save, or a bad row is written first
Alternative: a database constraint; rejected because the import script needs drafts with no title
```
