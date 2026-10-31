# Install Precedent and take the five-minute tour

## 1. Install

1. Open the installation link: `<installation link>`.
2. Install Precedent into **Jira** and **Confluence** on the same site. An org admin must install it, because Teamwork Graph reads need admin consent.
3. Make sure Rovo is on for the site. If your site has no Rovo, a Forge demo site has it.
4. Optional, for the coding-agent part of the tour: in Atlassian Administration, allow external MCP clients for Precedent. Rovo MCP access for Forge apps is in Preview and off by default.

## 2. Load the demo company

1. In Jira, open **Apps → Precedent** and go to the **Settings** tab.
2. Under **Demo company**:
   - pick a Jira project for the demo issues;
   - optionally pick a Confluence space for the demo pages;
   - select **Load demo company**.
3. Wait about a minute until the status reads "Acme Pay is loaded".

You now have:
- 12 ratified decisions, the pages they came from, and 3 candidates in the inbox;
- 6 Jira issues built to collide with those decisions.

## 3. Tour (about five minutes)

1. **Map tab.**
   - Health of every decision.
   - The LaunchDarkly decision is already **At risk**, because its contract renewal is ten days away.
2. **Inbox tab.**
   - Three decisions found in the "Platform sync" meeting notes.
   - **Ratify** one: it becomes binding and its owner is watched.
3. **Guard in Jira.**
   - Open the issue **"Migrate the ledger service to MongoDB for faster writes"**.
   - The **Precedent** panel flags a conflict with DEC-1, "Ledger stays on PostgreSQL", with the reason, the owner and the source page.
   - Try **Request review** or **Proceed anyway**: both are logged.
4. **Rovo.**
   - Open Rovo chat, pick the **Precedent** agent, and ask: *"Why did we keep the ledger on PostgreSQL?"*, then *"I want to add axios-retry to the payout webhooks. Any problem?"*
5. **Tripwires.**
   - In **Settings**, select **File 3 P1 incidents**.
   - On the **Map**, select **Run checks now**.
   - DEC-2, "Single region until incidents demand more", breaks: its JQL assumption ("two or fewer P1 incidents in 30 days") no longer holds.
   - A **Decision review** work item is created for its owner, and the decision shows as under review everywhere.
6. **Coding agents (MCP).** In a terminal with Claude Code:
   ```bash
   claude mcp add --transport http precedent <MCP URL from the Settings tab>
   ```
   Then ask Claude Code: *"Add retries to the payout webhook client using axios-retry. Check Precedent first."*
   - Claude calls `check-plan`, sees DEC-3 ("Outbound HTTP goes through acme-http"), and changes its plan.
   - It can record the decision it makes with `record-decision`, which lands in the Inbox.
   - The Map's **Who checked what** column shows the agent's checks.

## Troubleshooting

- **The panel says AI checking is off or over budget.** Matches still come from tags and words. Turn AI on, or raise the budget, under Settings → AI.
- **No Confluence spaces in Settings.** Install Precedent in Confluence on the same site. The demo still works without pages.
- **Teamwork Graph teams don't appear on the Map.** The installing org admin must grant the app's graph scopes. Precedent falls back to Jira lookups.
- **Reset.** Settings → Demo company → **Reset demo** removes the demo decisions and trashes the demo pages. Demo issues stay, labelled `precedent-demo`.
