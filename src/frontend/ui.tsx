import React from 'react';
import { Box, Heading, Inline, Link, Lozenge, Stack, Tag, TagGroup, Text, User, xcss } from '@forge/react';
import type { AssumptionState, DecisionSource, DecisionStatus, Health, SourceKind } from '../domain/types';
import type { AssumptionView, DecisionView } from '../views/decisionView';

type Appearance = 'default' | 'inprogress' | 'moved' | 'new' | 'removed' | 'success';

const HEALTH: Record<Health, [Appearance, string]> = {
  holding: ['success', 'Holding'],
  at_risk: ['moved', 'At risk'],
  broken: ['removed', 'Broken'],
};

const STATUS: Record<DecisionStatus, [Appearance, string]> = {
  candidate: ['new', 'Candidate'],
  ratified: ['success', 'Ratified'],
  under_review: ['moved', 'Under review'],
  superseded: ['default', 'Superseded'],
  dismissed: ['removed', 'Dismissed'],
};

const STATE: Record<AssumptionState, [Appearance, string]> = {
  holding: ['success', 'Holding'],
  at_risk: ['moved', 'At risk'],
  broken: ['removed', 'Broken'],
  unknown: ['default', 'Not checked'],
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  confluence_page: 'Confluence',
  jira_comment: 'Jira comment',
  jira_issue: 'Jira issue',
  agent_session: 'Agent',
  manual: 'Added by hand',
};

export const cardStyle = xcss({
  borderColor: 'color.border',
  borderStyle: 'solid',
  borderWidth: 'border.width',
  borderRadius: 'radius.medium',
  padding: 'space.200',
});

export function HealthLozenge({ health }: { health: Health }) {
  return <Lozenge appearance={HEALTH[health][0]}>{HEALTH[health][1]}</Lozenge>;
}

export function StatusLozenge({ status }: { status: DecisionStatus }) {
  return <Lozenge appearance={STATUS[status][0]}>{STATUS[status][1]}</Lozenge>;
}

export function StateLozenge({ state }: { state: AssumptionState }) {
  return <Lozenge appearance={STATE[state][0]}>{STATE[state][1]}</Lozenge>;
}

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <TagGroup>
      {tags.map((tag) => (
        <Tag key={tag} text={tag} />
      ))}
    </TagGroup>
  );
}

export function Sources({ sources }: { sources: DecisionSource[] }) {
  if (sources.length === 0) return null;
  return (
    <Stack space="space.050">
      {sources.map((source, index) => (
        <Stack key={`${source.kind}-${source.ref}-${index}`} space="space.025">
          <Inline space="space.075" alignBlock="center">
            <Text size="small" color="color.text.subtle">
              {SOURCE_LABEL[source.kind]}
            </Text>
            {source.url ? (
              <Link href={source.url} openNewTab>
                {source.title ?? source.url}
              </Link>
            ) : (
              <Text size="small">{source.title ?? source.ref}</Text>
            )}
          </Inline>
          {source.excerpt ? (
            <Text size="small" color="color.text.subtlest">
              “{source.excerpt}”
            </Text>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}

export function Assumptions({ assumptions }: { assumptions: AssumptionView[] }) {
  if (assumptions.length === 0) return null;
  return (
    <Stack space="space.075">
      {assumptions.map((assumption) => (
        <Stack key={assumption.id} space="space.025">
          <Inline space="space.100" alignBlock="center">
            <StateLozenge state={assumption.state} />
            <Text>{assumption.text}</Text>
          </Inline>
          <Text size="small" color="color.text.subtlest">
            {assumption.evidence ?? assumption.watchSummary}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}

/** A decision with its reasons, assumptions and sources. `children` renders the actions. */
export function DecisionCard({ decision, children }: { decision: DecisionView; children?: React.ReactNode }) {
  return (
    <Box xcss={cardStyle}>
      <Stack space="space.150">
        <Inline spread="space-between" alignBlock="start">
          <Heading size="xsmall">
            {decision.key} · {decision.title}
          </Heading>
          <Inline space="space.075">
            <StatusLozenge status={decision.status} />
            {decision.status !== 'candidate' ? <HealthLozenge health={decision.health} /> : null}
          </Inline>
        </Inline>
        <Text>{decision.statement}</Text>
        {decision.rationale ? <Text color="color.text.subtle">Why: {decision.rationale}</Text> : null}
        <Tags tags={decision.tags} />
        <Assumptions assumptions={decision.assumptions} />
        <Sources sources={decision.sources} />
        <Inline space="space.150" alignBlock="center" shouldWrap>
          {decision.ownerAccountId ? (
            <Inline space="space.075" alignBlock="center">
              <Text size="small" color="color.text.subtle">
                Owner
              </Text>
              <User accountId={decision.ownerAccountId} />
            </Inline>
          ) : null}
          {decision.originLabel ? (
            <Text size="small" color="color.text.subtle">
              {decision.originLabel}
            </Text>
          ) : null}
          {decision.decidedAt ? (
            <Text size="small" color="color.text.subtle">
              Decided {decision.decidedAt}
            </Text>
          ) : null}
        </Inline>
        {children}
      </Stack>
    </Box>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
