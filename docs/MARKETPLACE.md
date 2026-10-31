# Marketplace listing draft

**App name:** Precedent: decision guardrails for people and AI agents

**Tagline (≤ 80 characters):** Your team's decisions, enforced for people and AI coding agents

**Category:** Project management · Developer tools · Documentation

**Hosting:** Cloud (Forge). No egress: storage, AI and processing all run on Atlassian.

**Pricing:** Free during the beta.

## Summary

Precedent collects the decisions your team makes in Confluence and Jira, checks new work against them in Jira, in Rovo and in AI coding agents over MCP, and opens a review when the assumptions behind a decision stop holding.

## Highlights

1. **Decisions people and agents can't miss.** A Jira issue panel, a Rovo agent and MCP tools flag work that conflicts with a ratified decision, explain why the decision was made, and suggest a compliant approach.
2. **Tripwires on assumptions.** Each decision records what it depends on: an owner, a contract date, an incident rate, a goal. When one breaks, Precedent opens a review for the owner or a successor from their team.
3. **An inbox, not a chore.** Decisions are extracted from ADRs, meeting notes and comments. A teammate ratifies them in one click.

## Description

Engineering teams lose the "why". Decisions about databases, libraries, vendors and policies are buried in old pages and threads, so new people re-litigate them and AI coding agents violate them. Precedent turns those decisions into enforced, living context:

- **Collect:** from chosen Confluence spaces and Jira projects, or recorded by agents as they work.
- **Guard:** on every Jira issue, in Rovo chat, and in Claude Code or Cursor through MCP.
- **Tripwires:** watch the owner, dates, JQL counts and goal status, and open reviews automatically.
- **Decision Map:** health over time, what tripped, and which people and agents checked what.

Admins choose what's scanned, can switch AI off per feature, and set a monthly AI budget. Without AI, Precedent still matches work to decisions by tags and words.

## Screenshots to capture (1840×900)

1. Jira issue panel flagging the MongoDB conflict with DEC-1
2. Claude Code terminal calling `check-plan` and changing its plan
3. Decision Map with the health donut, tripwires and the "Who checked what" column
4. Inbox with candidates extracted from meeting notes
5. Rovo chat answering "Why did we keep the ledger on PostgreSQL?"

## Submission checklist (target: Sun Dec 13 2026)

- [ ] Marketplace partner (vendor) account created and agreements accepted
- [ ] App deployed to the **production** environment, with distribution enabled and a sharing link
- [ ] Logo 144×144 PNG, highlight images, and screenshots
- [ ] Privacy policy published at a public URL (from `docs/PRIVACY.md`)
- [ ] Support contact and documentation URL (the GitHub README)
- [ ] Data security and privacy questionnaire answered: Forge storage only, no egress, Forge LLMs
- [ ] Submit for approval, and copy the review ticket link into the Devpost form
