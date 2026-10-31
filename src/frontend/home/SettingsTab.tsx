import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  CodeBlock,
  Heading,
  Inline,
  Label,
  ProgressBar,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  Textfield,
  Toggle,
} from '@forge/react';
import type { Settings } from '../../config/settings';
import { isFailure, type Failure, type SettingsView } from '../../views/uiTypes';
import { call } from '../api';
import { cardStyle, errorMessage } from '../ui';

interface Option {
  label: string;
  value: string;
}

function chosen(options: Option[], values: string[]): Option[] {
  return options.filter((o) => values.includes(o.value));
}

const POLL_MS = 4000;

/** Loads Acme Pay, a fictional fintech with decisions, pages and issues that exercise every feature. */
function DemoCard({
  view,
  projectOptions,
  spaceOptions,
  onChanged,
}: {
  view: SettingsView;
  projectOptions: Option[];
  spaceOptions: Option[];
  onChanged: () => Promise<void>;
}) {
  const demo = view.settings.demo;
  const [projectKey, setProjectKey] = useState<string | undefined>(demo?.projectKey);
  const [spaceId, setSpaceId] = useState<string | undefined>(demo?.spaceId);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo?.status !== 'loading') return undefined;
    const timer = setInterval(() => void onChanged(), POLL_MS);
    return () => clearInterval(timer);
  }, [demo?.status, onChanged]);

  const run = async (name: string, payload: Record<string, unknown>, success: (r: Record<string, unknown>) => string) => {
    setBusy(true);
    try {
      const result = await call<Record<string, unknown> | Failure>(name, payload);
      setNotice(isFailure(result) ? result.error : success(result));
      await onChanged();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const status =
    demo?.status === 'loading'
      ? 'Building Acme Pay… this takes about a minute.'
      : demo?.status === 'failed'
        ? `The last load failed: ${demo.error ?? 'unknown error'}`
        : demo
          ? `Acme Pay is loaded in ${demo.projectKey}${demo.issueKeys.length ? ` (${demo.issueKeys.join(', ')})` : ''}.`
          : undefined;

  return (
    <Box xcss={cardStyle}>
      <Stack space="space.150">
        <Heading size="small">Demo company</Heading>
        <Text>
          Acme Pay is a fictional payments company. Loading it adds 12 ratified decisions, 3 in the inbox, the Confluence
          pages they came from, and Jira issues that conflict with them, such as "Migrate the ledger service to MongoDB".
        </Text>
        {status ? (
          <Inline space="space.100" alignBlock="center">
            {demo?.status === 'loading' ? <Spinner size="small" /> : null}
            <Text weight="medium">{status}</Text>
          </Inline>
        ) : null}
        {notice ? <Text size="small">{notice}</Text> : null}
        <Label labelFor="demo-project">Jira project for the demo issues</Label>
        <Select
          inputId="demo-project"
          options={projectOptions}
          value={chosen(projectOptions, projectKey ? [projectKey] : [])[0] ?? null}
          onChange={(option: Option | null) => setProjectKey(option?.value)}
        />
        <Label labelFor="demo-space">Confluence space for the demo pages (optional)</Label>
        <Select
          inputId="demo-space"
          isClearable
          options={spaceOptions}
          value={chosen(spaceOptions, spaceId ? [spaceId] : [])[0] ?? null}
          onChange={(option: Option | null) => setSpaceId(option?.value)}
        />
        <ButtonGroup>
          <Button
            appearance="primary"
            isDisabled={busy || !projectKey || !view.isAdmin || demo?.status === 'loading'}
            onClick={() => run('demo.load', { projectKey, spaceId }, () => 'Loading Acme Pay…')}
          >
            Load demo company
          </Button>
          <Button
            isDisabled={busy || demo?.status !== 'ready'}
            onClick={() =>
              run('demo.incidents', {}, (r) => `Filed ${(r.issueKeys as string[]).join(', ')}. Run checks now on the Map to see DEC-2 trip.`)
            }
          >
            File 3 P1 incidents
          </Button>
          <Button
            appearance="subtle"
            isDisabled={busy || !demo || !view.isAdmin}
            onClick={() => run('demo.reset', {}, (r) => `Removed ${r.removed} demo decisions. Demo issues stay, labelled precedent-demo.`)}
          >
            Reset demo
          </Button>
        </ButtonGroup>
      </Stack>
    </Box>
  );
}

/** Admin settings: what Precedent scans, where reviews go, how much AI it may use, and how agents connect. */
export function SettingsTab() {
  const [view, setView] = useState<SettingsView>();
  const [draft, setDraft] = useState<Settings>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await call<SettingsView>('settings.get');
      setView(result);
      setDraft(result.settings);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!view || !draft) return notice ? <Text>{notice}</Text> : <Spinner label="Loading settings" />;

  const projectOptions = view.projects.map((p) => ({ label: `${p.name} (${p.key})`, value: p.key }));
  const spaceOptions = view.spaces.map((s) => ({ label: `${s.name} (${s.key})`, value: s.id }));
  const usageRatio = view.usage.budget > 0 ? Math.min(1, view.usage.tokens / view.usage.budget) : 0;
  const locked = !view.isAdmin;

  const save = async () => {
    setBusy(true);
    try {
      const result = await call<{ settings: Settings } | Failure>('settings.save', { settings: draft });
      setNotice(isFailure(result) ? result.error : 'Settings saved.');
      if (!isFailure(result)) await load();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    const result = await call<{ ok: true } | Failure>('harvest.scanNow');
    setNotice(isFailure(result) ? result.error : 'Scan queued. New decisions appear in the inbox within a few minutes.');
  };

  return (
    <Stack space="space.300">
      {locked ? (
        <SectionMessage appearance="information">
          <Text>Only Jira admins can change these settings.</Text>
        </SectionMessage>
      ) : null}
      {notice ? (
        <SectionMessage appearance="information">
          <Text>{notice}</Text>
        </SectionMessage>
      ) : null}

      <DemoCard view={view} projectOptions={projectOptions} spaceOptions={spaceOptions} onChanged={load} />

      <Box xcss={cardStyle}>
        <Stack space="space.150">
          <Heading size="small">Where decisions come from</Heading>
          <Label labelFor="spaces">Confluence spaces to scan</Label>
          {spaceOptions.length ? (
            <Select
              inputId="spaces"
              isMulti
              isDisabled={locked}
              options={spaceOptions}
              value={chosen(spaceOptions, draft.confluenceSpaceIds)}
              onChange={(options: Option[] | null) => setDraft({ ...draft, confluenceSpaceIds: (options ?? []).map((o) => o.value) })}
            />
          ) : (
            <Text size="small" color="color.text.subtle">
              Install Precedent in Confluence on this site to scan pages.
            </Text>
          )}
          <Label labelFor="projects">Jira projects whose comments are scanned</Label>
          <Select
            inputId="projects"
            isMulti
            isDisabled={locked}
            options={projectOptions}
            value={chosen(projectOptions, draft.jiraProjectKeys)}
            onChange={(options: Option[] | null) => setDraft({ ...draft, jiraProjectKeys: (options ?? []).map((o) => o.value) })}
          />
          <Label labelFor="review">Project for "Decision review" work items</Label>
          <Select
            inputId="review"
            isClearable
            isDisabled={locked}
            options={projectOptions}
            value={chosen(projectOptions, draft.reviewProjectKey ? [draft.reviewProjectKey] : [])[0] ?? null}
            onChange={(option: Option | null) => setDraft({ ...draft, reviewProjectKey: option?.value })}
          />
          <ButtonGroup>
            <Button onClick={scan}>Scan now</Button>
          </ButtonGroup>
        </Stack>
      </Box>

      <Box xcss={cardStyle}>
        <Stack space="space.150">
          <Heading size="small">AI</Heading>
          <Text size="small" color="color.text.subtle">
            Precedent uses Forge LLMs, so content never leaves Atlassian. With AI off it still works, matching work to
            decisions by tags and words.
          </Text>
          <Inline space="space.100" alignBlock="center">
            <Toggle
              id="ai-harvest"
              label="Extract decisions from pages and comments"
              isChecked={draft.ai.harvest}
              isDisabled={locked}
              onChange={() => setDraft({ ...draft, ai: { ...draft.ai, harvest: !draft.ai.harvest } })}
            />
            <Text>Extract decisions from pages and comments</Text>
          </Inline>
          <Inline space="space.100" alignBlock="center">
            <Toggle
              id="ai-guard"
              label="Judge conflicts with AI"
              isChecked={draft.ai.guard}
              isDisabled={locked}
              onChange={() => setDraft({ ...draft, ai: { ...draft.ai, guard: !draft.ai.guard } })}
            />
            <Text>Judge conflicts with AI</Text>
          </Inline>
          <Label labelFor="budget">Monthly token budget (0 for no cap)</Label>
          <Textfield
            id="budget"
            type="number"
            isDisabled={locked}
            value={String(draft.monthlyTokenBudget)}
            onChange={(e) => setDraft({ ...draft, monthlyTokenBudget: Number(e.target.value) || 0 })}
          />
          <Text size="small">
            {view.usage.month}: {view.usage.tokens.toLocaleString()} tokens in {view.usage.calls} calls
            {view.usage.budget > 0 ? ` of ${view.usage.budget.toLocaleString()}` : ''}
          </Text>
          {view.usage.budget > 0 ? <ProgressBar value={usageRatio} appearance={usageRatio > 0.9 ? 'default' : 'success'} /> : null}
        </Stack>
      </Box>

      {view.isAdmin ? (
        <ButtonGroup>
          <Button appearance="primary" isDisabled={busy} onClick={save}>
            Save settings
          </Button>
        </ButtonGroup>
      ) : null}

      <Box xcss={cardStyle}>
        <Stack space="space.150">
          <Heading size="small">Connect a coding agent</Heading>
          <Text>
            Precedent's tools (search decisions, check a plan, record a decision, get a work item's context) are available
            over MCP. A site admin first allows external MCP clients for Precedent, then each developer runs:
          </Text>
          <CodeBlock language="bash" text={`claude mcp add --transport http precedent ${view.mcpUrl ?? 'https://mcp.atlassian.com/forge/<app-id>'}`} />
          <Text size="small" color="color.text.subtle">
            Cursor and other MCP clients use the same URL. Each developer signs in with their Atlassian account, so checks are
            logged under their name.
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}
