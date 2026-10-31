# Demo video script (target 2:50, hard limit 5:00)

Judges may stop at three minutes, so the whole story lands before 3:00. Record at 1440p, with the browser zoomed to 125%. Use a fresh demo site with Acme Pay loaded, the LaunchDarkly decision showing **At risk**, and Claude Code connected over MCP.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:15 | Black, then the Precedent Map | "Your team made hundreds of decisions last year. Your new hire knows none of them. Your AI coding agent knows none of them. And some of them are already wrong." |
| 0:15–0:30 | Map: health donut, timeline | "Precedent turns those decisions into living context. Here's Acme Pay: twelve binding decisions, each with why it was made, who owns it, and the assumptions it rests on." |
| 0:30–0:45 | Inbox: ratify "Payment APIs require idempotency keys" | "It finds new decisions in Confluence and Jira. These came from last week's meeting notes. One click makes a decision binding." |
| 0:45–1:10 | Jira issue "Migrate the ledger to MongoDB", Precedent panel | "Now someone proposes moving the ledger to MongoDB. Precedent flags the conflict with DEC-1, explains why the team chose PostgreSQL, links the ADR, and offers a review if the facts have changed." |
| 1:10–1:45 | Terminal: Claude Code asked to "add axios-retry to payout webhooks" | "The same check runs for AI agents. Over MCP, Claude Code asks Precedent before writing code, learns that outbound HTTP must go through acme-http, and changes its plan. Then it records the backoff decision it made, straight into the inbox." |
| 1:45–2:20 | Settings: File 3 incidents. Map: Run checks now. Review issue opens. | "Decisions rest on assumptions. DEC-2 keeps payments in one region while there are two or fewer P1 incidents a month. Three incidents later, the tripwire breaks. Precedent opens a review for the owner, or for a teammate from Teamwork Graph if the owner has left." |
| 2:20–2:40 | Rovo chat with the Precedent agent | "Anyone can ask why. The Precedent Rovo agent answers from the team's own record, with sources, and its check is a reusable Rovo skill other agents can use." |
| 2:40–2:50 | Architecture slide | "Built on Forge: Teamwork Graph, a Rovo agent and skill, an MCP server, Forge LLMs and Forge SQL. Data never leaves Atlassian, and admins cap AI spend. Precedent: your team's case law, enforced for people and AI agents." |

## Recording checklist

- [ ] Fresh site, demo loaded, inbox has 3 candidates, LaunchDarkly shows At risk
- [ ] "Migrate the ledger service to MongoDB" open in a tab
- [ ] Claude Code connected (`claude mcp list` shows `precedent`), and a repo with a `payouts/webhook-client.ts` stub open
- [ ] Rovo chat open with the Precedent agent selected
- [ ] Notifications off, bookmarks bar hidden, 125% zoom
- [ ] Upload to YouTube as **Public**, and put the link in the Devpost submission
