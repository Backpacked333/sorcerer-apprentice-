# Prompt · Integration checkpoint (every lane, at M1 · M2 · M3 · M4)

Paste this into your orchestrator at each checkpoint time (7:30 PM · 10:30 PM · 1:30 AM · 3:30 AM ET). It takes about ten minutes and ends with a status file the whole team reads.

---

```text
CHECKPOINT <M1|M2|M3|M4> for lane <A|B|C|D>. Stop starting new work. Do the following in order and report tersely.

1. LAND WHAT IS GREEN
   - List every open branch/worktree/PR of this lane with its state.
   - For each that passes `npm run typecheck && npm test`: rebase on origin/main, push, merge. For each that does not: leave it unmerged and say why in one line. Never merge red.
   - Then: git checkout main && git pull && npm install && npm run typecheck && npm test. Paste the tail.

2. PROVE THE CHECKPOINT BAR
   - Read the bar for this checkpoint in docs/04-TEAM-PROTOCOL.md §4 and the "Done when" lines for this checkpoint in docs/lanes/<lane>.md.
   - For each line, state: PASS (with the evidence: a test name, a log line, a metric) | FAIL | NEEDS-HUMAN.
   - For every NEEDS-HUMAN item, write the exact 2-minute script my human must run (URL to open, what to click or say, what they must see or hear). Do not write "verified" for anything only a human can verify.

3. KEYLESS INSURANCE
   - Run the keyless path (seed + smoke, per AGENTS.md §5). If it is broken by this lane's changes since the last checkpoint, the fix is P0 and comes before everything else.

4. CONTRACTS
   - List every contract change this lane made since the last checkpoint (docs/03-CONTRACTS.md). Confirm each is additive and documented. List every contract change this lane is WAITING on from another lane (with the handshake id from docs/01-SPEC.md §8.4).

5. ISSUES
   - `gh issue list -l lane:<lane>` — summarize open P0/P1 issues assigned to this lane. File new issues for anything found above that belongs to another lane (`gh issue create -l lane:<owner> -l P0|P1`).

6. CUT OR KEEP
   - If any P0 work package due at this checkpoint is not done: give an honest estimate, and say which item from the cut list (docs/01-SPEC.md §11) you recommend cutting to protect it. At M4: list everything unmerged and recommend "ship without" for each.

7. WRITE docs/status/<lane>.md (overwrite) with exactly these sections and commit it:
   ## Checkpoint <M?> — <time ET>
   ### Done and merged (WP ids)
   ### Verified live by a human (who, when, what they did)
   ### Not verified yet (and the script to verify)
   ### Blocked on (lane, handshake id, what exactly)
   ### Next 3 things
   ### Risks I see for the demo

Then give me a five-line summary I can paste into the team chat.
```
