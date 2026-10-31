---
name: precedent-check
description: Check proposed work against the team's binding decisions before planning or changing anything, and record new decisions made along the way. Use whenever a task involves choosing a technology, library, data store, vendor, architecture or policy.
---

# Precedent check

Teams make decisions that future work must respect: which database the ledger uses, which HTTP client every service calls, what never gets logged. Precedent keeps those decisions, the reasons behind them and the assumptions they rest on.

## Before you plan or change anything

1. Summarize the intended work in a few sentences: what changes, and which services, libraries, data stores, vendors and policies it touches.
2. Call `check-plan` with that summary. Include the Jira work item key if there is one.
3. Read the reply:
   - **CONFLICT** lines are blocking. Don't do the conflicting part. Change the plan to respect the decision, using the suggested approach when one is given. If the user insists, tell them to request a review of the decision instead of silently overriding it.
   - **APPLIES** lines constrain how to do the work. Follow them.
   - A decision marked under review may change soon. Mention that to the user.

## When the reason matters

Call `search-decisions` to answer "why do we…" questions. Quote decision keys (DEC-n) and link the sources it returns. If nothing matches, say the team hasn't recorded a decision. Never invent one.

## After you choose an approach

If you made a choice that future work should stay consistent with, call `record-decision` with a short title, a one-sentence statement, the rationale and any assumptions (one per line). It lands in Precedent's inbox as a candidate until a teammate ratifies it.
