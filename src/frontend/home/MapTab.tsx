import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  DonutChart,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Tag,
  TagGroup,
  Text,
  User,
  xcss,
} from '@forge/react';
import type { CheckChannel } from '../../domain/types';
import type { SweepResult } from '../../tripwires/engine';
import type { MapView } from '../../views/mapView';
import { call } from '../api';
import { cardStyle, errorMessage, HealthLozenge, plural, StatusLozenge } from '../ui';

const CHANNEL: Record<CheckChannel, string> = {
  panel: 'Jira panel',
  rovo: 'Rovo',
  mcp: 'Coding agent',
  skill: 'Rovo skill',
};

const columnStyle = xcss({ flexGrow: 1, minWidth: '260px', maxWidth: '520px' });

function sweepSummary(result: SweepResult): string {
  const broken = result.broken.length
    ? ` ${result.broken
        .map((b) => `${b.key} broke${b.reviewIssueKey ? `, review ${b.reviewIssueKey} opened` : ''}`)
        .join('; ')}.`
    : ' Nothing new broke.';
  return `Checked ${plural(result.checked, 'assumption')} across ${plural(result.decisions, 'decision')}.${broken}`;
}

/** The health of every binding decision over time, with what tripped and who has been checking work. */
export function MapTab() {
  const [map, setMap] = useState<MapView>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    try {
      setMap(await call<MapView>('map.data'));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runChecks = async () => {
    setRunning(true);
    try {
      setNotice(sweepSummary(await call<SweepResult>('tripwires.runNow')));
      await load();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  if (!map) return error ? <Text>{error}</Text> : <Spinner label="Loading the decision map" />;

  const chart = [
    { health: 'Holding', count: map.counts.holding },
    { health: 'At risk', count: map.counts.at_risk },
    { health: 'Broken', count: map.counts.broken },
  ];

  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Text color="color.text.subtle">
          {plural(map.total, 'binding decision')}. Each assumption is re-checked every hour, or now:
        </Text>
        <Button appearance="primary" isDisabled={running} onClick={runChecks}>
          {running ? 'Checking…' : 'Run checks now'}
        </Button>
      </Inline>
      {notice ? (
        <SectionMessage appearance={notice.includes('broke') ? 'warning' : 'information'}>
          <Text>{notice}</Text>
        </SectionMessage>
      ) : null}

      <Inline space="space.300" shouldWrap>
        <Box xcss={columnStyle}>
          <Stack space="space.150">
            <Heading size="small">Health</Heading>
            {map.total > 0 ? (
              <DonutChart data={chart} colorAccessor="health" valueAccessor="count" labelAccessor="health" height={240} />
            ) : (
              <Text>No binding decisions yet.</Text>
            )}
            {map.topTags.length ? (
              <TagGroup>
                {map.topTags.map((t) => (
                  <Tag key={t.tag} text={`${t.tag} · ${t.count}`} />
                ))}
              </TagGroup>
            ) : null}
            {map.teams.length ? (
              <Stack space="space.075">
                <Heading size="xxsmall">By owner's team (Teamwork Graph)</Heading>
                {map.teams.map((team) => (
                  <Text key={team.team} size="small">
                    {team.team}: {team.decisionKeys.join(', ')}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Box>

        <Box xcss={columnStyle}>
          <Stack space="space.150">
            <Heading size="small">Recent tripwires</Heading>
            {map.events.length === 0 ? <Text>No assumption has changed state yet.</Text> : null}
            {map.events.map((event, index) => (
              <Stack key={`${event.createdAt}-${index}`} space="space.025">
                <Inline space="space.075" alignBlock="center">
                  <Lozenge appearance={event.toState === 'broken' ? 'removed' : event.toState === 'at_risk' ? 'moved' : 'success'}>
                    {event.toState.replace('_', ' ')}
                  </Lozenge>
                  <Text weight="medium">{event.decisionKey ?? 'Decision'}</Text>
                  {event.reviewIssueKey ? <Text size="small">review {event.reviewIssueKey}</Text> : null}
                  {event.successorAccountId ? <User accountId={event.successorAccountId} /> : null}
                </Inline>
                <Text size="small" color="color.text.subtle">
                  {event.evidence}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box xcss={columnStyle}>
          <Stack space="space.150">
            <Heading size="small">Who checked what</Heading>
            {map.checks.length === 0 ? <Text>No work has been checked yet.</Text> : null}
            {map.checks.map((check) => (
              <Stack key={check.id} space="space.025">
                <Inline space="space.075" alignBlock="center">
                  <Lozenge appearance={check.channel === 'mcp' ? 'new' : 'default'}>{CHANNEL[check.channel]}</Lozenge>
                  {check.actor && !check.actor.includes(':') ? <Text size="small">{check.actor}</Text> : null}
                  {check.actor?.includes(':') ? <User accountId={check.actor} /> : null}
                  {check.conflicts ? <Lozenge appearance="removed">{plural(check.conflicts, 'conflict')}</Lozenge> : null}
                </Inline>
                <Text size="small" color="color.text.subtle" maxLines={2}>
                  {check.subject}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Inline>

      <Stack space="space.200">
        <Heading size="small">Timeline</Heading>
        {map.months.map((group) => (
          <Stack key={group.month} space="space.100">
            <Heading size="xxsmall">{group.label}</Heading>
            {group.decisions.map((d) => (
              <Box key={d.id} xcss={cardStyle}>
                <Inline spread="space-between" alignBlock="center" shouldWrap>
                  <Stack space="space.025">
                    <Text weight="medium">
                      {d.key} · {d.title}
                    </Text>
                    <Text size="small" color="color.text.subtle" maxLines={1}>
                      {d.statement}
                    </Text>
                  </Stack>
                  <Inline space="space.075" alignBlock="center">
                    {d.ownerAccountId ? <User accountId={d.ownerAccountId} /> : null}
                    <StatusLozenge status={d.status} />
                    <HealthLozenge health={d.health} />
                  </Inline>
                </Inline>
              </Box>
            ))}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
