import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  ButtonGroup,
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
  User,
  useProductContext,
} from '@forge/react';
import { call } from './api';
import type { Finding } from '../guard/check';
import { isFailure, type DecisionResult, type Failure, type PanelView } from '../views/uiTypes';
import { errorMessage, HealthLozenge, plural, Sources } from './ui';

type Mode = 'idle' | 'override' | 'review';

function FindingCard({ finding, issueKey, onChanged }: { finding: Finding; issueKey: string; onChanged: () => void }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'override') {
        await call('panel.override', { issueKey, decisionKey: finding.key, reason });
        setNotice('Override noted in a comment on this issue.');
      } else {
        const result = await call<DecisionResult | Failure>('decision.requestReview', { decisionKey: finding.key, reason, issueKey });
        setNotice(isFailure(result) ? result.error : `Review opened${result.reviewIssueKey ? ` as ${result.reviewIssueKey}` : ''}.`);
        onChanged();
      }
      setMode('idle');
      setReason('');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const conflict = finding.verdict === 'conflict';
  return (
    <SectionMessage appearance={conflict ? 'error' : 'information'} title={`${finding.key}: ${finding.title}`}>
      <Stack space="space.100">
        <Text>{finding.reason}</Text>
        {finding.suggestion ? <Text>Instead: {finding.suggestion}</Text> : null}
        <Text size="small" color="color.text.subtle">
          The decision: {finding.statement}
        </Text>
        <Inline space="space.100" alignBlock="center">
          {finding.ownerAccountId ? (
            <Inline space="space.075" alignBlock="center">
              <Text size="small" color="color.text.subtle">
                Owner
              </Text>
              <User accountId={finding.ownerAccountId} />
            </Inline>
          ) : null}
          <HealthLozenge health={finding.health} />
        </Inline>
        <Sources sources={finding.sources} />
        {notice ? <Text size="small">{notice}</Text> : null}
        {mode === 'idle' ? (
          <ButtonGroup>
            <Button onClick={() => setMode('review')}>Request review</Button>
            {conflict ? (
              <Button appearance="subtle" onClick={() => setMode('override')}>
                Proceed anyway
              </Button>
            ) : null}
          </ButtonGroup>
        ) : (
          <Stack space="space.100">
            <Textfield
              placeholder={mode === 'override' ? 'Why proceed anyway?' : 'What should the owner reconsider?'}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <ButtonGroup>
              <Button appearance="primary" isDisabled={busy || reason.trim().length === 0} onClick={submit}>
                {mode === 'override' ? 'Log override' : 'Open review'}
              </Button>
              <Button appearance="subtle" onClick={() => setMode('idle')}>
                Cancel
              </Button>
            </ButtonGroup>
          </Stack>
        )}
      </Stack>
    </SectionMessage>
  );
}

function headline(conflicts: number, related: number): string {
  if (conflicts > 0) return `${plural(conflicts, 'conflict')} with your team's decisions`;
  if (related > 0) return `${plural(related, 'related decision')} to keep in mind`;
  return 'No team decisions apply to this issue.';
}

const App = () => {
  const context = useProductContext();
  const issueKey: string | undefined = context?.extension?.issue?.key;
  const [view, setView] = useState<PanelView>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!issueKey) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await call<PanelView | Failure>('panel.check', { issueKey });
      if (isFailure(result)) setError(result.error);
      else setView(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [issueKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <SectionMessage appearance="warning" title="Precedent couldn't check this issue">
        <Stack space="space.100">
          <Text>{error}</Text>
          <Button onClick={load}>Try again</Button>
        </Stack>
      </SectionMessage>
    );
  }
  if (!view) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner size="small" />
        <Text>Checking this work against your team's decisions…</Text>
      </Inline>
    );
  }

  const conflicts = view.findings.filter((f) => f.verdict === 'conflict');
  const related = view.findings.filter((f) => f.verdict !== 'conflict');
  return (
    <Stack space="space.200">
      <Inline spread="space-between" alignBlock="center">
        <Text weight="medium">{headline(conflicts.length, related.length)}</Text>
        <Button appearance="subtle" isDisabled={loading} onClick={load}>
          {loading ? 'Checking…' : 'Re-check'}
        </Button>
      </Inline>
      {[...conflicts, ...related].map((finding) => (
        <FindingCard key={finding.key} finding={finding} issueKey={view.issueKey} onChanged={load} />
      ))}
      {view.note ? (
        <Text size="small" color="color.text.subtlest">
          {view.note}
        </Text>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
