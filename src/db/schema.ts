import { migrationRunner } from '@forge/sql';

/** Forward-only migrations, applied in order. Never edit a released migration; add a new one. */
export const MIGRATIONS: ReadonlyArray<readonly [name: string, statement: string]> = [
  [
    'v001_create_decisions',
    `CREATE TABLE IF NOT EXISTS decisions (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      seq INT NOT NULL,
      dkey VARCHAR(16) NOT NULL,
      title VARCHAR(255) NOT NULL,
      statement TEXT NOT NULL,
      rationale TEXT NOT NULL,
      status VARCHAR(16) NOT NULL,
      origin VARCHAR(16) NOT NULL,
      origin_label VARCHAR(255) NULL,
      owner_account_id VARCHAR(128) NULL,
      deciders TEXT NULL,
      decided_at VARCHAR(10) NULL,
      linked_issue_key VARCHAR(64) NULL,
      superseded_by VARCHAR(16) NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      UNIQUE KEY uq_decisions_seq (seq),
      UNIQUE KEY uq_decisions_key (dkey),
      KEY idx_decisions_status (status)
    )`,
  ],
  [
    'v002_create_decision_tags',
    `CREATE TABLE IF NOT EXISTS decision_tags (
      decision_id BIGINT NOT NULL,
      tag VARCHAR(64) NOT NULL,
      PRIMARY KEY (decision_id, tag),
      KEY idx_tags_tag (tag)
    )`,
  ],
  [
    'v003_create_decision_sources',
    `CREATE TABLE IF NOT EXISTS decision_sources (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      decision_id BIGINT NOT NULL,
      kind VARCHAR(32) NOT NULL,
      ref VARCHAR(255) NOT NULL,
      url TEXT NULL,
      title VARCHAR(255) NULL,
      excerpt TEXT NULL,
      KEY idx_sources_decision (decision_id),
      KEY idx_sources_ref (kind, ref)
    )`,
  ],
  [
    'v004_create_assumptions',
    `CREATE TABLE IF NOT EXISTS assumptions (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      decision_id BIGINT NOT NULL,
      text TEXT NOT NULL,
      watch TEXT NOT NULL,
      state VARCHAR(16) NOT NULL,
      last_checked_at VARCHAR(30) NULL,
      evidence TEXT NULL,
      KEY idx_assumptions_decision (decision_id)
    )`,
  ],
  [
    'v005_create_tripwire_events',
    `CREATE TABLE IF NOT EXISTS tripwire_events (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      decision_id BIGINT NOT NULL,
      assumption_id BIGINT NULL,
      from_state VARCHAR(16) NULL,
      to_state VARCHAR(16) NOT NULL,
      evidence TEXT NOT NULL,
      review_issue_key VARCHAR(64) NULL,
      successor_account_id VARCHAR(128) NULL,
      created_at VARCHAR(30) NOT NULL,
      KEY idx_events_decision (decision_id)
    )`,
  ],
  [
    'v006_create_check_log',
    `CREATE TABLE IF NOT EXISTS check_log (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      channel VARCHAR(16) NOT NULL,
      actor VARCHAR(255) NULL,
      subject VARCHAR(512) NOT NULL,
      conflicts INT NOT NULL,
      decision_keys TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL
    )`,
  ],
];

let ready: Promise<void> | undefined;
let enqueued = false;

/** Applies pending migrations once per runtime. Safe to call at the start of every handler. */
export function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    if (!enqueued) {
      for (const [name, statement] of MIGRATIONS) migrationRunner.enqueue(name, statement);
      enqueued = true;
    }
    await migrationRunner.run();
  })().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
