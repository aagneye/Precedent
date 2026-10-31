import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ButtonGroup,
  EmptyState,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  TextArea,
  Textfield,
} from '@forge/react';
import { call } from '../api';
import type { DecisionView } from '../../views/decisionView';
import { isFailure, type DecisionList, type DecisionResult, type Failure } from '../../views/uiTypes';
import { DecisionCard, errorMessage, plural } from '../ui';

interface Draft {
  title: string;
  statement: string;
  rationale: string;
  tags: string;
}

function draftOf(decision: DecisionView): Draft {
  return { title: decision.title, statement: decision.statement, rationale: decision.rationale, tags: decision.tags.join(', ') };
}

function patchOf(draft: Draft) {
  return {
    title: draft.title,
    statement: draft.statement,
    rationale: draft.rationale,
    tags: draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function EditModal({ decision, onClose, onSaved }: { decision: DecisionView; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(decision));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (ratifyToo: boolean) => {
    setBusy(true);
    try {
      const result = await call<DecisionResult | Failure>(ratifyToo ? 'decision.ratify' : 'decision.update', {
        id: decision.id,
        patch: patchOf(draft),
      });
      if (isFailure(result)) setError(result.error);
      else onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width="large">
      <ModalHeader>
        <ModalTitle>Edit {decision.key}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150">
          {error ? (
            <SectionMessage appearance="error">
              <Text>{error}</Text>
            </SectionMessage>
          ) : null}
          <Label labelFor="title">Title</Label>
          <Textfield id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Label labelFor="statement">Decision</Label>
          <TextArea id="statement" value={draft.statement} onChange={(e) => setDraft({ ...draft, statement: e.target.value })} />
          <Label labelFor="rationale">Why</Label>
          <TextArea id="rationale" value={draft.rationale} onChange={(e) => setDraft({ ...draft, rationale: e.target.value })} />
          <Label labelFor="tags">Scope tags (comma separated)</Label>
          <Textfield id="tags" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button isDisabled={busy} onClick={() => save(false)}>
            Save
          </Button>
          <Button appearance="primary" isDisabled={busy} onClick={() => save(true)}>
            Save and ratify
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </Modal>
  );
}

/** New decisions found by the harvester or recorded by agents, waiting for a person to ratify them. */
export function InboxTab() {
  const [decisions, setDecisions] = useState<DecisionView[]>();
  const [editing, setEditing] = useState<DecisionView>();
  const [busyId, setBusyId] = useState<number>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const result = await call<DecisionList>('inbox.list');
      setDecisions(result.decisions);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (decision: DecisionView, action: 'ratify' | 'dismiss') => {
    setBusyId(decision.id);
    try {
      const result =
        action === 'ratify'
          ? await call<DecisionResult | Failure>('decision.ratify', { id: decision.id })
          : await call<DecisionResult | Failure>('decision.setStatus', { id: decision.id, status: 'dismissed' });
      if (isFailure(result)) setError(result.error);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(undefined);
    }
  };

  if (!decisions) return error ? <Text>{error}</Text> : <Spinner label="Loading the inbox" />;

  return (
    <Stack space="space.200">
      {error ? (
        <SectionMessage appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {decisions.length === 0 ? (
        <EmptyState
          header="Inbox zero"
          description="Decisions Precedent finds in Confluence and Jira, and the ones AI agents record while they work, land here for a person to ratify."
        />
      ) : (
        <Text color="color.text.subtle">
          {plural(decisions.length, 'decision')} waiting for review. Ratified decisions become binding: the guard checks new work
          against them and their assumptions are watched.
        </Text>
      )}
      {decisions.map((decision) => (
        <DecisionCard key={decision.id} decision={decision}>
          <ButtonGroup>
            <Button appearance="primary" isDisabled={busyId === decision.id} onClick={() => act(decision, 'ratify')}>
              Ratify
            </Button>
            <Button isDisabled={busyId === decision.id} onClick={() => setEditing(decision)}>
              Edit
            </Button>
            <Button appearance="subtle" isDisabled={busyId === decision.id} onClick={() => act(decision, 'dismiss')}>
              Dismiss
            </Button>
          </ButtonGroup>
        </DecisionCard>
      ))}
      <ModalTransition>
        {editing ? (
          <EditModal
            decision={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              void load();
            }}
          />
        ) : null}
      </ModalTransition>
    </Stack>
  );
}
