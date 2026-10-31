import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ButtonGroup,
  DynamicTable,
  Heading,
  Inline,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  Select,
  Spinner,
  Stack,
  Text,
  Textfield,
  User,
} from '@forge/react';
import { call } from '../api';
import type { DecisionStatus } from '../../domain/types';
import type { DecisionView } from '../../views/decisionView';
import { isFailure, type DecisionDetail, type DecisionList, type DecisionResult, type Failure } from '../../views/uiTypes';
import { DecisionCard, errorMessage, HealthLozenge, StatusLozenge } from '../ui';

const STATUS_OPTIONS = [
  { label: 'All binding and retired', value: '' },
  { label: 'Ratified', value: 'ratified' },
  { label: 'Under review', value: 'under_review' },
  { label: 'Superseded', value: 'superseded' },
];

function DetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<DecisionDetail>();
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await call<DecisionDetail | Failure>('decision.detail', { id });
    if (isFailure(result)) setNotice(result.error);
    else setDetail(result);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (call: () => Promise<DecisionResult | Failure>, success: (r: DecisionResult) => string) => {
    setBusy(true);
    try {
      const result = await call();
      setNotice(isFailure(result) ? result.error : success(result));
      await load();
      onChanged();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  const decision = detail?.decision;
  return (
    <Modal onClose={onClose} width="x-large">
      <ModalHeader>
        <ModalTitle>{decision ? `${decision.key} · ${decision.title}` : 'Decision'}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        {!detail || !decision ? (
          <Spinner label="Loading the decision" />
        ) : (
          <Stack space="space.200">
            <DecisionCard decision={decision} />
            {notice ? <Text>{notice}</Text> : null}
            {detail.events.length > 0 ? (
              <Stack space="space.100">
                <Heading size="xxsmall">Tripwire history</Heading>
                {detail.events.map((event, index) => (
                  <Stack key={`${event.createdAt}-${index}`} space="space.025">
                    <Text size="small" color="color.text.subtle">
                      {event.createdAt.slice(0, 16).replace('T', ' ')} · {event.toState.replace('_', ' ')}
                      {event.reviewIssueKey ? ` · review ${event.reviewIssueKey}` : ''}
                    </Text>
                    <Text size="small">{event.evidence}</Text>
                  </Stack>
                ))}
              </Stack>
            ) : null}
            {asking ? (
              <Stack space="space.100">
                <Textfield placeholder="What should the owner reconsider?" value={reason} onChange={(e) => setReason(e.target.value)} />
              </Stack>
            ) : null}
          </Stack>
        )}
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button appearance="subtle" onClick={onClose}>
            Close
          </Button>
          {decision?.status === 'ratified' && !asking ? <Button onClick={() => setAsking(true)}>Request review</Button> : null}
          {decision?.status === 'ratified' && asking ? (
            <Button
              appearance="primary"
              isDisabled={busy || !reason.trim()}
              onClick={() =>
                run(
                  () => call('decision.requestReview', { decisionKey: decision.key, reason }),
                  (r) => `Review opened${r.reviewIssueKey ? ` as ${r.reviewIssueKey}` : ''}.`,
                )
              }
            >
              Open review
            </Button>
          ) : null}
          {decision && decision.status !== 'ratified' ? (
            <Button
              appearance="primary"
              isDisabled={busy}
              onClick={() => run(() => call('decision.setStatus', { id: decision.id, status: 'ratified' }), () => 'Re-ratified.')}
            >
              Re-ratify
            </Button>
          ) : null}
          {decision && decision.status !== 'superseded' ? (
            <Button
              appearance="warning"
              isDisabled={busy}
              onClick={() => run(() => call('decision.setStatus', { id: decision.id, status: 'superseded' }), () => 'Retired.')}
            >
              Retire
            </Button>
          ) : null}
        </ButtonGroup>
      </ModalFooter>
    </Modal>
  );
}

const HEAD = {
  cells: [
    { key: 'key', content: 'Key', isSortable: true },
    { key: 'title', content: 'Decision' },
    { key: 'status', content: 'Status' },
    { key: 'health', content: 'Health' },
    { key: 'owner', content: 'Owner' },
    { key: 'decided', content: 'Decided', isSortable: true },
  ],
};

/** Every binding decision, searchable, with a detail view for reviewing, re-ratifying or retiring it. */
export function DecisionsTab() {
  const [decisions, setDecisions] = useState<DecisionView[]>();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string>('');
  const [openId, setOpenId] = useState<number>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const result = await call<DecisionList>('decisions.list', { text, status: status || undefined });
      setDecisions(result.decisions);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [text, status]);

  useEffect(() => {
    void load();
    // Reload on status changes only; a typed search runs when Search is pressed.
  }, [status]);

  const rows = (decisions ?? []).map((d) => ({
    key: String(d.id),
    cells: [
      { key: d.key, content: d.key },
      {
        key: 'title',
        content: (
          <Button appearance="subtle" onClick={() => setOpenId(d.id)}>
            {d.title}
          </Button>
        ),
      },
      { key: 'status', content: <StatusLozenge status={d.status as DecisionStatus} /> },
      { key: 'health', content: <HealthLozenge health={d.health} /> },
      { key: 'owner', content: d.ownerAccountId ? <User accountId={d.ownerAccountId} /> : '' },
      { key: d.decidedAt ?? '', content: d.decidedAt ?? '' },
    ],
  }));

  return (
    <Stack space="space.200">
      <Inline space="space.100" alignBlock="end" shouldWrap>
        <Textfield placeholder="Search decisions or DEC-n" value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={load}>Search</Button>
        <Select
          options={STATUS_OPTIONS}
          value={STATUS_OPTIONS.find((o) => o.value === status)}
          onChange={(option: { value: string } | null) => setStatus(option?.value ?? '')}
        />
      </Inline>
      {error ? <Text>{error}</Text> : null}
      <DynamicTable
        head={HEAD}
        rows={rows}
        rowsPerPage={15}
        isLoading={!decisions}
        emptyView={<Text>No decisions match. Ratify some from the inbox, or load the demo company in Settings.</Text>}
      />
      <ModalTransition>
        {openId !== undefined ? <DetailModal id={openId} onClose={() => setOpenId(undefined)} onChanged={load} /> : null}
      </ModalTransition>
    </Stack>
  );
}
