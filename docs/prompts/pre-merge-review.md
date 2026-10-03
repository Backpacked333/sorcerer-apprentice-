# Prompt · Pre-merge review (any lane)

Paste this before merging anything non-trivial, or have your orchestrator run it as a **fresh sub-agent that sees only the diff** (a reviewer that wrote the code will agree with itself).

---

```text
You are reviewing a pull request for the Tacit hackathon repo. You did not write this code. Be skeptical and fast.

Read first: AGENTS.md (the non-negotiables and the ownership table) and docs/03-CONTRACTS.md.

Then review ONLY the diff of the current branch against origin/main:
  git fetch origin && git diff origin/main...HEAD

Report findings in this order, most severe first. For each: file:line, what breaks, the smallest fix.

1. LANE VIOLATIONS — any file changed that is not owned by lane <A|B|C|D> per AGENTS.md §3. (A courtesy PR may touch exactly one foreign file.)
2. CONTRACT BREAKS — any rename, removal or type/meaning change of something in docs/03-CONTRACTS.md; any additive contract change that did not update docs/03-CONTRACTS.md in the same diff.
3. NON-NEGOTIABLES (AGENTS.md §4) — hardcoded invoice ids / thresholds / dialogue; a Quote that is not a verbatim substring of expert speech; a rule created without a stated trigger; the agent able to speak outside a turn; a vision event labeled as dom or vice versa; a struck item that survives somewhere; a tutor/guard/export that loads an unconfirmed map; anything from the private role card (docs/05 §3) encoded into prompts, seed data, or the live path.
4. CORRECTNESS — logic bugs with a concrete failing input. Race conditions around: the mic gate, consent epoch, stale vision responses, tool-result ordering, effects that re-create intervals.
5. KEYLESS MODE — does `npm run seed:session` + the smoke path still work with no keys? Does every new real-service call have a labeled fallback?
6. TESTS — is there a new test file for new logic (not edits to lib/engines.test.ts unless this is lane C)? Do the tests assert the behavior or just execute it?
7. SCOPE — which requirement ID (docs/01-SPEC.md §4) or work package (§8.3) does this serve? If none, say "out of scope".

Run: npm run typecheck && npm test. Paste the tail of the output.

End with exactly one line:
VERDICT: MERGE | FIX-THEN-MERGE (list the must-fix items) | DO-NOT-MERGE (why)
Do not rewrite the code yourself. Do not pad the review with style nits.
```
