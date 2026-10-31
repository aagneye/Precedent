# Precedent

**Your team's case law, enforced for people and AI agents.**

Precedent is an Atlassian Forge app built for Codegeist 2026. It does three things:

- **Collects** the decisions your team makes in Confluence and Jira, along with the reasons and the assumptions behind them.
- **Guards** new work against those decisions, whether a person or an AI coding agent is doing it. It shows up in the Jira issue panel, through a Rovo agent and skill, and as MCP tools for Claude Code and Cursor.
- **Raises a tripwire** when an assumption stops holding. It opens a Jira review for the decision's owner, or for their successor if the owner has left.

## Development

You need Node 22.23.4 or newer and the Forge CLI (`npm install -g @forge/cli`).

```bash
npm install
npm run check      # typecheck + unit tests
forge lint
```
