# Precedent: Codegeist 2026 build plan

## Context

**Why we're building this.** Atlassian Codegeist 2026 asks for a Forge app that uses Teamwork Graph context to help teams "ship with confidence".

- **Prizes:** $15k for 1st in each category. A project can win at most one main prize plus one $1.5k bonus.
- **Deadline:** **Tue Dec 22 2026, 12:00 PM PT**, which is Wed Dec 23, 01:30 IST.
- **Team:** solo developer.
- **Platform choices:** Forge LLMs for AI, and a Marketplace listing for the business and the bonus.

**What the research found** (Oct 31 2026):
- Teams and their AI agents lose the *why* behind decisions:
  - Only 20% say their team shares decisions well.
  - A study of 33k agent pull requests lists "misaligned with the project" among the reasons they get rejected.
  - Decisions made while coding never reach Jira.
- Teamwork Graph has **no "decision" object**.
- `rovo:mcp` and `rovo:skill` are brand new (Preview since Oct 29 2026).
- Crowded categories to avoid: sprint dashboards, pull-request bots, incident copilots, release notes, retros, standups and outdated-page checkers.

**What we'll ship.** Precedent: *your team's case law, enforced for people and AI agents.* It:
- collects decisions from Confluence and Jira;
- checks them when a person or a coding agent (Claude Code or Cursor, over MCP) starts work;
- watches the assumptions behind each decision, and opens a Jira review when one breaks.

**Category and bonuses.** We submit to *Apps for Software Teams*, and list the Rovo agent, MCP, Teamwork Graph and Marketplace bonuses.

**Success criteria:**
- Stage 1 passes.
- A judge installs the app, clicks "Load demo company", and sees everything working within 5 minutes.
- The video lands the Claude Code moment before 1:30.
- The app has a Marketplace review ticket.

---

## Product: what judges see
1. **Collect**
   - Precedent scans the Confluence pages and Jira comments you choose, and the Forge LLM extracts each decision: statement, rationale, owner, date, scope tags and **assumptions**.
   - Candidates go to a **Decision Inbox**, where you ratify, edit or dismiss each one.
2. **Guard**
   - A **Jira issue panel** shows relevant decisions and flags conflicts. You can proceed (the override is logged) or request a review.
   - A **Rovo agent** answers "why" questions with sources.
   - A **`rovo:skill`**, `precedent-check`, lets other agents reuse the check.
   - **`rovo:mcp` tools** for Claude Code and Cursor:
     - `search_decisions`
     - `check_plan`
     - `record_decision`
     - `get_issue_context`
3. **Tripwires**
   - Each assumption has a watcher, run on a schedule or by clicking "Run checks now". There are four kinds:
     - the **owner** was deactivated (Precedent suggests a successor from Teamwork Graph teams);
     - a **date** expired;
     - a **JQL** count crossed a threshold;
     - a linked **goal** went off-track.
   - When one breaks, Precedent opens a Jira work item, "Decision review: DEC-n", and marks the decision *under review* everywhere it appears.
4. **Decision Map:** a timeline with health chips (holding, at risk or broken), linked to goals, teams and projects.
5. **Admin settings:** which spaces and projects to scan, AI on or off per source, and a monthly AI budget cap. When the cap is hit, checks fall back to deterministic tag matching.
6. **Load demo company:** a fictional fintech, *Acme Pay*.
   - It creates about 12 decision-bearing Confluence pages in a space you pick, plus PAY-style issues and comments in a Jira project you pick.
   - It pre-loads 12 decisions so judges don't wait on AI, and leaves 3 for the Inbox so they can ratify one live.

**Stretch goals, only if time allows:**
- Writing decisions into Teamwork Graph through `graph:connector`
- Collecting from Loom
- A Bitbucket merge check
- Weekly AI re-checks of free-text assumptions
- Detecting when a source page drifts from its decision
- A Confluence byline

---

## Architecture

**Stack:**
- TypeScript
- Forge UI Kit (`@forge/react`) on every screen, for a native Atlassian look and speed
- `@forge/api`, `@forge/resolver`, `@forge/sql`, `@forge/kvs`, `@forge/events` (queues) and `@forge/llm`
- `zod` for validating AI output, and `vitest` for tests

Check the syntax of every brand-new module against developer.atlassian.com before relying on it.

**Install topology:**
- **Default:** one app with Jira and Confluence modules. Jira is the "home": Forge SQL, the global page and the issue panel live there.
- **Confirm on deploy:** that one installation shares storage across both products.
- **Fallback:** a Jira-only install that reads Confluence through Teamwork Graph or REST.

**Manifest modules:**

| Module | Purpose |
|---|---|
| `jira:issuePanel` | Precedent panel: relevant decisions and conflict cards |
| `jira:globalPage` (or its current equivalent) | Home: Inbox, Decisions, Map and Settings tabs |
| `rovo:agent` | "Precedent" agent: prompt, actions and the `precedent-check` skill |
| `action` × 6 | `search-decisions`, `check-plan`, `record-decision`, `get-issue-context`, `request-review`, `list-under-review` |
| `rovo:skill` | `precedent-check` (a SKILL.md plus the check actions) |
| `rovo:mcp` | Exposes the 4 MCP tools to external clients (`https://mcp.atlassian.com/forge/<appId>`) |
| `trigger` | Jira comment created; Confluence page created and updated |
| `scheduledTrigger` | Tripwire sweep (hourly); collection sweep (daily) |
| `consumer` + queue | Backfill and AI extraction jobs (up to 900 s) |
| `llm` | Forge LLMs: a cheap model to classify text, a stronger one to extract and judge |
| `sql` | Forge SQL with migrations |
| scopes | Read and write Jira work; read users; read and write Confluence pages; `read:graph:*` for users, teams and goals; storage |

**Code layout:**
```
manifest.yml, package.json, tsconfig.json, vitest.config.ts, .gitignore, README.md
src/
  index.ts                  # exports every handler
  domain/                   # pure logic, unit-tested: types, tags, retrieval ranking, tripwire state machine
  ai/                       # llm client, budget meter, prompts (classify/extract/judge), JSON parsing
  db/                       # schema + migrations, repositories (decisions, sources, tags, assumptions, events, check_log)
  integrations/             # jira.ts, confluence.ts, twg.ts (Teamwork Graph queries)
  harvest/                  # page/comment collectors + extraction pipeline (queue consumer)
  guard/                    # relevance + conflict check (shared by panel, Rovo, MCP)
  tripwires/                # engine + watchers (owner, date, jql, goal) + successor suggestion
  actions/                  # Rovo/MCP action handlers
  resolvers/                # UI resolvers (inbox, panel, map, settings, demo)
  demo/                     # Acme Pay fixtures + seeding
  frontend/                 # UI Kit: panel.tsx, home.tsx (+ components)
skills/precedent-check/SKILL.md
test/                       # vitest specs for domain, ai parsing, guard, tripwires
docs/                       # PLAN.md, INSTALL_FOR_JUDGES.md, DEMO_SCRIPT.md, MARKETPLACE.md, PRIVACY.md
```
The domain logic depends on interfaces for the database, Jira and the AI, so I can unit-test it with fakes.

**Data model (Forge SQL):**
- `decisions`
  - `id`, `key` (DEC-n), `title`, `statement`, `rationale`
  - `status`: candidate, ratified, under_review, superseded or dismissed
  - `owner_account_id`, `deciders`, `decided_at`, `origin` (harvest, agent or user)
  - `created_at`, `updated_at`, `superseded_by`
- `decision_tags`: `decision_id`, `tag`, indexed (services, technologies, vendors, policies)
- `decision_sources`: `kind` (page, comment, issue, agent_session or manual), `ref`, `url`, `excerpt`
- `assumptions`
  - `text`
  - `watch_type`: owner, date, jql, goal or manual
  - `watch_config`: JSON
  - `state`: holding, at_risk, broken or unknown
  - `last_checked_at`, `evidence`
- `tripwire_events`: the state change, the evidence and `review_issue_key`
- `check_log`: channel (panel, rovo, mcp or skill), actor, subject and result. This is the audit trail of what agents asked.
- **Key-value storage (KVS):** settings, monthly AI usage, and collection cursors

**How the "guard" finds relevant decisions** (no vector DB needed at about 500 decisions):
1. Extract tags from the issue or plan text: a cheap AI call, or deterministic keywords when the budget is used up.
2. Use a SQL tag overlap plus keyword `LIKE` to pick the top 15 candidates.
3. A stronger AI model judges each candidate as conflicting, relevant or irrelevant, with a reason. Its answer is validated so it can only cite candidate keys.

---

## Build order (one atomic commit each)
1. `git init`, the remote and `.gitignore`
2. `chore: scaffold Forge app` (package.json, tsconfig, vitest, README)
3. `docs: add build plan`
4. `feat(domain): decision model, tag normalization` + tests
5. `feat(ai): Forge LLM client, JSON validation, budget guard` + tests
6. `feat(db): SQL schema, migrations, repositories`
7. `feat(harvest): extract decisions from Confluence pages and Jira comments`
8. `feat(guard): relevance ranking and conflict judgment` + tests
9. `feat(jira): Precedent issue panel`
10. `feat(home): decision inbox and decision list`
11. `feat(rovo): Precedent agent, actions, precedent-check skill`
12. `feat(mcp): expose decision tools via rovo:mcp`
13. `feat(tripwires): watchers, review work items, successor suggestion` + tests
14. `feat(graph): Teamwork Graph reads for teams, goals and people`
15. `feat(map): decision map with health`
16. `feat(settings): admin settings and AI budget cap`
17. `feat(demo): Acme Pay demo company seeding`
18. `docs: judge install guide, demo script, Marketplace listing draft, privacy policy`

## After the code: deploy and prove it

**Manual steps for the account owner:**
- `forge login` with an Atlassian API token
- The payment card for Forge LLMs
- Creating the Marketplace partner account
- The site-admin switch that turns on external MCP access
- Recording and uploading the video
- Submitting on Devpost

**Node and the Forge CLI.** The Forge CLI needs Node 22.23.4 or newer.

**Calendar:**

| Dates | Milestone |
|---|---|
| Nov 1 to 8 | `forge site provision` (gives a demo site with Rovo), then `forge register`, `deploy` and `install`. The golden path works on the demo site, and the topology is confirmed. |
| Nov 9 to Dec 6 | Fix real-world issues, polish the design, stretch goals |
| Dec 7 to 13 | Production deploy, distribution link, **Marketplace submission by Dec 13** |
| Dec 14 to 21 | **Freeze Dec 16**, clean-site test, video, Devpost write-up, **submit by Dec 21** |

## Demo video (under 3 minutes for the core story)
1. **0:00, the hook.** "Your team made 400 decisions last year. Your new hire and your AI agent know none, and 30 are now wrong."
2. **0:15, Collect.** Load Acme Pay and ratify a decision.
3. **0:40, Guard.**
   - A "Migrate ledger to MongoDB" issue raises a conflict with DEC-1.
   - In Claude Code, `check_plan` flags DEC-3 (no new HTTP libraries), so Claude switches to `acme-http`. Then it calls `record_decision`.
4. **1:25, Tripwires.** Three incidents get filed. "Run checks" breaks DEC-2, and a review goes to the owner's successor.
5. **2:10, Rovo and the Map.** Ask Rovo a "why" question, then open the Decision Map.
6. **2:40, close.** Impact, the architecture, and the admin controls.

## Verification
- **Every commit:**
  - `npm run typecheck` and `npm test`, which runs vitest on the domain, AI parsing, guard and tripwires.
  - `forge lint`, once the CLI is installed.
- **On the demo site,** using `forge tunnel`, run the golden path above end to end:
  - The Inbox fills with decisions.
  - The panel shows a conflict on the MongoDB issue.
  - Connect Claude Code with `claude mcp add --transport http precedent https://mcp.atlassian.com/forge/<appId>`. Then `check_plan` returns DEC-3, and `record_decision` shows up in the Inbox.
  - Three incidents plus "Run checks" turn DEC-2 broken and create the review issue.
  - Rovo chat answers with sources.
  - The Map shows the health chips.
- **Before submitting:** install from the distribution link on a fresh site, following only `docs/INSTALL_FOR_JUDGES.md`.

## Risks and fallbacks
- **Rovo is missing on free dev sites.** Use the `forge site provision` demo site.
- **Teamwork Graph needs allowlisting or returns empty results silently.**
  - Log the scopes it was given.
  - Owner status falls back to the Jira user API.
  - Goal watchers report "unknown" instead of failing.
- **`rovo:mcp` is in Preview and needs an admin switch.**
  - The judge guide covers turning it on.
  - Fallback demo: a Rovo Studio agent using the same tools.
- **Storage may not be shared across products.** Use the Jira-only topology.
- **Forge LLM costs.**
  - A budget cap, with a deterministic fallback.
  - Cheap models for classifying text.
- **Marketplace review takes time.** Submit by Dec 13. A review ticket is enough for the bonus.
