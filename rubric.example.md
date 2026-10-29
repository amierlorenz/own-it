# own-it rubric

Used in the review phase. Claude scores your change on each criterion, then asks you questions instead of giving fixes.
Copy this file to `~/.config/amierlorenz-skills/own-it.md` and edit it. Without that file, this one is used.

## Scale

| Score | Meaning |
|---|---|
| 1 Missing | Not considered, or wrong in a way that would get the PR rejected |
| 2 Developing | Considered, but with gaps you couldn't defend if a maintainer pushed |
| 3 Solid | Mergeable. You can explain every choice |
| 4 Exemplary | A maintainer would point to it as the way to do it |

**Pass bar:** every criterion at 3 or above, and no hard fail. Performance can be N/A when the change isn't on a hot path.
Anything below 3 isn't a fail: it sends you back to the execute loop with that criterion's probes.

## Hard fails (block the commit whatever the scores)

- A test fails, or the change has no way to be checked (no test, no repro steps)
- Secrets, tokens or personal data in the diff
- Code you can't explain in the teach-back
- An open question that isn't marked answered or obsolete
- Changes outside the approved plan that nobody discussed
- Unhandled input from users, files or the network reaching a dangerous call (shell, SQL, eval, file paths, HTML)

## Criteria

### 1. Correctness and verification (weight 2)
Does it do what the issue asks, including the edge cases, and can you prove it?
- **1:** Happy path only, checked by eye
- **2:** Happy path tested, edge cases unknown
- **3:** Edge cases named and tested (empty, huge, missing, concurrent, wrong type)
- **4:** The tests would catch a realistic regression, and fail for the right reason (you saw them fail first)

**Probes:** What input breaks this? Which test fails if I delete line X? Did you watch the test fail before it passed?

### 2. Scope discipline (weight 2)
Is the diff the smallest change that solves the problem?
- **1:** Unrelated refactors, formatting churn, drive-by fixes
- **2:** Mostly on topic, a few extras
- **3:** Every changed line traces back to the issue
- **4:** Small enough to review in one sitting, with follow-ups split into separate issues

**Probes:** Which lines could you delete and still close the issue? What did you notice but deliberately leave alone?

### 3. Fit with the codebase (weight 2)
Does it look like the project wrote it?
- **1:** New patterns, libraries or styles where the project already has one
- **2:** Follows style, but reinvents a helper that exists
- **3:** Uses the project's existing helpers, naming, error handling and test style
- **4:** Matches CONTRIBUTING.md and the conventions of the nearest neighbouring code

**Probes:** Where else in the repo is something like this done? Why didn't you reuse it? What does CONTRIBUTING.md say about this?

### 4. Complexity (weight 2)
From *A Philosophy of Software Design*: complexity is anything that makes code hard to understand or change. Its symptoms are **change amplification** (one change needs edits in many places), **cognitive load** (how much you must hold in your head) and **unknown unknowns** (what you don't know you need to know).
- **1:** A future change would need edits in many places, or relies on knowledge that isn't written anywhere
- **2:** Works, but a reader has to trace several files to follow it
- **3:** A reader can follow it from one place, and changes stay local
- **4:** Simpler than what was there before

**Probes:** If the requirement changes slightly, how many files do you touch? What does a reader need to know that the code doesn't tell them?

### 5. Module depth and information hiding (weight 1)
A **deep module** hides a lot of work behind a small interface. A **shallow** one has an interface nearly as complex as what it does. **Information leakage** is when one design decision shows up in several modules.
- **1:** Pass-through functions, wrappers that add nothing, internals exposed to callers
- **2:** Some leakage (callers need to know the order of calls, or the format of internal data)
- **3:** Interfaces are small, and callers don't need to know how it works
- **4:** Common cases need no configuration, and some errors are designed out of existence rather than handled

**Probes:** What does a caller need to know to use this? Could that be smaller? Which function just passes its arguments along?

### 6. Readability (weight 1)
Can someone new understand it without you in the room?
- **1:** Vague names (`data`, `handle`, `tmp`), or comments that repeat the code
- **2:** Readable, but a clever line or two needs explaining
- **3:** Names say what things are; comments say what the code can't (why, units, invariants, gotchas)
- **4:** Obvious code: a reader's first guess about what it does is right

**Probes:** Read this function name aloud. Does it tell you what it returns? Which comment would you want if you came back in six months?

### 7. Errors and failure modes (weight 1)
- **1:** Errors swallowed, or crashes with no context
- **2:** Errors caught but with vague messages, or handled at the wrong level
- **3:** Fails loudly, with a message that says what to do next, at the level that can act on it
- **4:** Impossible states are made unrepresentable, so there's less to handle

**Probes:** What happens when this call fails? Who finds out, and what do they see?

### 8. Security (weight 2)
- **1:** Trusts input it shouldn't, or adds a dependency nobody checked
- **2:** Validates some input, misses a path
- **3:** Every entry point validated; least privilege; no new dependency without a reason
- **4:** You can name the threat (who would attack this, and how) and show why it fails

**Probes:** Where does this data come from? Who controls it? What's the worst value they could send?

### 9. Performance (weight 1, only when the change is on a hot path)
- **1:** Accidental quadratic loops, N+1 queries, unbounded memory
- **2:** Fine for small inputs, unknown at scale
- **3:** You know the input size it'll see, and it handles it
- **4:** Measured, not guessed

**Probes:** How big does this input get in real use? What's the cost per call?

### 10. Ownership (weight 2)
Scored from the teach-back, not the code.
- **1:** Can't explain a chunk, or explains what but not why
- **2:** Explains each chunk, but not the alternatives
- **3:** For each chunk: what it does, why this way, one alternative and why not
- **4:** Can predict what breaks if a chunk is removed, before running it

**Probes:** Cover the code. What does this hunk do? What would you do differently with another day?

## Your own criteria

Add the ones that matter for the project or the skill you're building. Keep the same four levels.
