import { OWNER_ASSUMPTION } from '../harvest/pipeline';
import type { NewAssumption } from '../domain/types';

/** Acme Pay: a fictional Indian fintech whose decisions, pages and issues exercise every Precedent feature. */

export interface DemoPage {
  slug: string;
  title: string;
  storage: string;
}

export interface DemoDecision {
  pageSlug: string;
  title: string;
  statement: string;
  rationale: string;
  decidedAt: string;
  tags: string[];
  assumptions: NewAssumption[];
  status: 'ratified' | 'candidate';
}

export interface DemoIssue {
  summary: string;
  description: string;
  labels: string[];
  comment?: string;
}

export const DEMO_LABEL = 'precedent-demo';

export const DEMO_INDEX = {
  title: 'Acme Pay engineering handbook (Precedent demo)',
  storage:
    '<p>Architecture records, policies and meeting notes for Acme Pay, the fictional payments company used to demo Precedent.</p>',
};

export const ACME_PAGES: DemoPage[] = [
  {
    slug: 'adr-ledger',
    title: 'ADR-001: The ledger stays on PostgreSQL',
    storage:
      '<h2>Status</h2><p>Accepted on 2 March 2026 by Payments Platform.</p>' +
      '<h2>Context</h2><p>The ledger records every money movement. A transfer that half-commits corrupts balances, and month-end write peaks keep growing.</p>' +
      '<h2>Decision</h2><p>We keep the ledger service on PostgreSQL. We will not move ledger data to a document store such as MongoDB.</p>' +
      '<h2>Consequences</h2><ul><li>Multi-row transfers stay in one ACID transaction.</li><li>We scale with read replicas and partitioning, and revisit if ledger writes pass 5,000 per second.</li></ul>',
  },
  {
    slug: 'adr-region',
    title: 'ADR-002: One region until incidents say otherwise',
    storage:
      '<h2>Status</h2><p>Accepted on 20 January 2026.</p>' +
      '<h2>Decision</h2><p>We run payments in a single AWS region, ap-south-1, and do not build multi-region failover yet.</p>' +
      '<h2>Why</h2><p>Multi-region doubles infrastructure cost and on-call load. Our incident rate does not justify it.</p>' +
      '<h2>Revisit when</h2><p>We see more than two P1 incidents in a 30-day window.</p>',
  },
  {
    slug: 'adr-http',
    title: 'ADR-003: All outbound HTTP goes through acme-http',
    storage:
      '<h2>Status</h2><p>Accepted on 11 May 2026.</p>' +
      '<h2>Decision</h2><p>Every service sends outbound HTTP through our acme-http client. We do not add other HTTP client libraries such as axios or got.</p>' +
      '<p>Retries use exponential backoff with jitter, capped at 30 seconds.</p>' +
      '<h2>Why</h2><p>acme-http gives every call the same retries, timeouts and tracing, and backoff stops us hammering partners during their outages.</p>',
  },
  {
    slug: 'security',
    title: 'Security policy: card data and AI',
    storage:
      '<h2>Card data</h2><p>Decided on 18 November 2025: we never log full card numbers (PAN) or CVV, in any environment. Logging card data pulls every log system into PCI DSS scope.</p>' +
      '<h2>AI</h2><p>Decided on 21 August 2026: we redact customer data before sending anything to an LLM, to stay compliant with the DPDP Act and our customer contracts.</p>',
  },
  {
    slug: 'vendors',
    title: 'Vendor decisions 2026',
    storage:
      '<h2>Feature flags</h2><p>Decided on 9 February 2026: we use LaunchDarkly for feature flags and will not build our own flag service before the contract renewal. Buying was cheaper than building while the team is small.</p>',
  },
  {
    slug: 'api',
    title: 'Public API guidelines',
    storage:
      '<h2>Decision</h2><p>Agreed on 3 June 2026: public partner APIs are REST with OpenAPI 3.1 specs. We do not expose GraphQL publicly.</p>' +
      "<p>Partners' tooling expects OpenAPI, and REST keeps rate limiting and caching simple.</p>",
  },
  {
    slug: 'principles',
    title: 'Architecture principles',
    storage:
      '<p>Agreed at the December 2025 architecture review:</p>' +
      "<ul><li>We publish domain events to Kafka. Services don't call each other synchronously to broadcast changes.</li>" +
      '<li>We keep all backend services in one monorepo, for atomic cross-service changes and a single CI pipeline.</li></ul>',
  },
  {
    slug: 'mobile',
    title: 'Mobile support matrix',
    storage:
      '<p>Decided on 15 April 2026: the Android app supports Android 10 (API 29) and newer. Under 2% of active users are on older versions, which lack the security APIs we need.</p>',
  },
  {
    slug: 'oncall',
    title: 'On-call ownership',
    storage: '<p>Decided on 1 July 2026: the Payments team owns ledger alerts around the clock.</p>',
  },
  {
    slug: 'platform-sync',
    title: 'Platform sync, 14 October 2026',
    storage:
      '<h2>Attendees</h2><p>Payments Platform, Partner Integrations, SRE</p>' +
      '<h2>Notes</h2><ul><li>Duplicate payouts last week came from client retries without idempotency.</li><li>Two partners asked how to verify our webhooks.</li></ul>' +
      '<h2>Decisions</h2><ul><li>We require an idempotency key on every payment-creating API call.</li>' +
      '<li>We sign every outgoing webhook with HMAC-SHA256 and a per-partner secret.</li>' +
      '<li>Settlement reports run daily at 02:00 IST.</li></ul>',
  },
];

function manual(text: string): NewAssumption {
  return { text, watch: { type: 'manual' } };
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** The demo decisions, in the order that gives DEC-1, DEC-2 and DEC-3 their demo roles on a fresh install. */
export function acmeDecisions(projectKey: string, today: Date): DemoDecision[] {
  const renewal = addDays(today, 10);
  const decision = (d: Omit<DemoDecision, 'status' | 'assumptions'> & { assumptions?: NewAssumption[]; status?: DemoDecision['status'] }): DemoDecision => ({
    ...d,
    status: d.status ?? 'ratified',
    assumptions: [OWNER_ASSUMPTION, ...(d.assumptions ?? [])],
  });
  return [
    decision({
      pageSlug: 'adr-ledger',
      title: 'Ledger stays on PostgreSQL',
      statement: "We keep the ledger service on PostgreSQL and don't move ledger data to a document store such as MongoDB.",
      rationale: 'Every money movement must commit atomically, and PostgreSQL gives us ACID transactions across rows.',
      decidedAt: '2026-03-02',
      tags: ['ledger-service', 'postgresql', 'mongodb', 'database'],
      assumptions: [manual('Ledger writes stay under 5,000 per second')],
    }),
    decision({
      pageSlug: 'adr-region',
      title: 'Single region until incidents demand more',
      statement: "We run payments in one AWS region (ap-south-1) and don't build multi-region failover yet.",
      rationale: "Multi-region doubles infrastructure cost and on-call load, and our incident rate doesn't justify it yet.",
      decidedAt: '2026-01-20',
      tags: ['multi-region', 'failover', 'aws', 'infrastructure'],
      assumptions: [
        {
          text: 'Two or fewer P1 incidents in 30 days',
          watch: { type: 'jql', jql: `project = ${projectKey} AND labels = incident AND created >= -30d`, operator: 'gt', threshold: 2 },
        },
      ],
    }),
    decision({
      pageSlug: 'adr-http',
      title: 'Outbound HTTP goes through acme-http',
      statement: 'We send all outbound HTTP calls through acme-http and add no other HTTP client libraries such as axios or got.',
      rationale: 'acme-http gives every call the same retries, timeouts and tracing.',
      decidedAt: '2026-05-11',
      tags: ['acme-http', 'http-client', 'axios', 'retries'],
    }),
    decision({
      pageSlug: 'security',
      title: 'Never log card numbers',
      statement: 'We never log full card numbers (PAN) or CVV, in any environment.',
      rationale: 'Logging card data pulls every log system into PCI DSS scope and risks a breach.',
      decidedAt: '2025-11-18',
      tags: ['card-data', 'pci-dss', 'logging', 'chargebacks'],
    }),
    decision({
      pageSlug: 'vendors',
      title: 'LaunchDarkly for feature flags until renewal',
      statement: "We use LaunchDarkly for feature flags and don't build our own flag service before the contract renewal.",
      rationale: 'Buying was cheaper than building while the team is small.',
      decidedAt: '2026-02-09',
      tags: ['launchdarkly', 'feature-flags'],
      assumptions: [{ text: `The LaunchDarkly contract runs until ${renewal}`, watch: { type: 'date', expiresOn: renewal, warnDays: 14 } }],
    }),
    decision({
      pageSlug: 'api',
      title: 'Public APIs are REST with OpenAPI',
      statement: 'We expose public partner APIs as REST with OpenAPI 3.1 specs, not GraphQL.',
      rationale: "Partners' tooling expects OpenAPI, and REST keeps rate limiting and caching simple.",
      decidedAt: '2026-06-03',
      tags: ['public-api', 'rest', 'openapi', 'graphql'],
    }),
    decision({
      pageSlug: 'principles',
      title: 'Domain events go through Kafka',
      statement: "We publish domain events to Kafka; services don't call each other synchronously to broadcast changes.",
      rationale: 'Decoupled services can deploy and fail independently.',
      decidedAt: '2025-12-10',
      tags: ['kafka', 'events', 'event-bus'],
    }),
    decision({
      pageSlug: 'principles',
      title: 'Backend services live in one monorepo',
      statement: 'We keep all backend services in one monorepo.',
      rationale: 'Atomic cross-service changes and a single CI pipeline.',
      decidedAt: '2025-12-10',
      tags: ['monorepo', 'repositories', 'ci'],
    }),
    decision({
      pageSlug: 'adr-http',
      title: 'Retries back off with jitter',
      statement: 'We retry outbound calls with exponential backoff and jitter, capped at 30 seconds.',
      rationale: "Backoff stops us hammering partners during their outages.",
      decidedAt: '2026-05-11',
      tags: ['retries', 'backoff', 'webhooks'],
    }),
    decision({
      pageSlug: 'security',
      title: 'No customer data in LLM prompts without redaction',
      statement: 'We redact customer data before sending anything to an LLM.',
      rationale: "Keeps us compliant with India's DPDP Act and our customer contracts.",
      decidedAt: '2026-08-21',
      tags: ['llm', 'ai', 'pii', 'redaction'],
    }),
    decision({
      pageSlug: 'mobile',
      title: 'Android app supports Android 10 and newer',
      statement: 'We support Android 10 (API 29) and newer in the Android app.',
      rationale: 'Older versions lack the security APIs we need.',
      decidedAt: '2026-04-15',
      tags: ['android', 'mobile'],
      assumptions: [manual('Fewer than 2% of active users are on Android 9 or older')],
    }),
    decision({
      pageSlug: 'oncall',
      title: 'Payments team owns ledger alerts',
      statement: 'The Payments team owns ledger alerts around the clock.',
      rationale: 'One owner keeps response times predictable.',
      decidedAt: '2026-07-01',
      tags: ['on-call', 'ledger-service', 'alerts'],
    }),
    decision({
      pageSlug: 'platform-sync',
      title: 'Payment APIs require idempotency keys',
      statement: 'We require an idempotency key on every payment-creating API call.',
      rationale: 'Client retries without idempotency caused duplicate payouts.',
      decidedAt: '2026-10-14',
      tags: ['idempotency', 'payments-api'],
      status: 'candidate',
    }),
    decision({
      pageSlug: 'platform-sync',
      title: 'Webhooks are signed with HMAC-SHA256',
      statement: 'We sign every outgoing webhook with HMAC-SHA256 and a per-partner secret.',
      rationale: 'Partners need a way to verify webhooks came from us.',
      decidedAt: '2026-10-14',
      tags: ['webhooks', 'security', 'hmac'],
      status: 'candidate',
    }),
    decision({
      pageSlug: 'platform-sync',
      title: 'Settlement reports run at 02:00 IST',
      statement: 'We generate settlement reports daily at 02:00 IST.',
      rationale: 'Banks publish their files by 01:30 IST.',
      decidedAt: '2026-10-14',
      tags: ['settlement', 'reports'],
      status: 'candidate',
    }),
  ];
}

export const ACME_ISSUES: DemoIssue[] = [
  {
    summary: 'Migrate the ledger service to MongoDB for faster writes',
    description:
      'Ledger writes slow down at month-end. Proposal: move ledger documents to MongoDB, which should handle our write volume better.',
    labels: [DEMO_LABEL],
  },
  {
    summary: 'Add retries to payout webhooks',
    description: 'Bank payout webhooks fail intermittently. Plan: wrap the calls with axios and axios-retry, retrying every second up to 10 times.',
    labels: [DEMO_LABEL],
    comment: 'From the platform sync: outbound HTTP must go through acme-http, see ADR-003.',
  },
  {
    summary: 'Expose a public GraphQL endpoint for partners',
    description: "Partners keep asking for flexible queries. Let's add a public GraphQL API next to the REST one.",
    labels: [DEMO_LABEL],
  },
  {
    summary: 'Log full card details to debug chargebacks',
    description: 'Chargeback disputes are hard to debug. Temporarily log the full card payload (PAN and expiry) in the payments service.',
    labels: [DEMO_LABEL],
  },
  {
    summary: 'Evaluate multi-region failover for payments',
    description: "After last month's outage, evaluate an active-passive setup across ap-south-1 and ap-southeast-1.",
    labels: [DEMO_LABEL],
  },
  {
    summary: 'Send transaction descriptions to an LLM for categorisation',
    description: 'Use an LLM to categorise transactions from their raw descriptions, which include customer names and UPI IDs.',
    labels: [DEMO_LABEL],
  },
];

export function incidentIssues(count: number, now: Date): DemoIssue[] {
  const time = now.toISOString().slice(11, 16);
  return Array.from({ length: count }, (_, i) => ({
    summary: `P1: Payment API timeouts in ap-south-1 (${time} UTC, #${i + 1})`,
    description: 'Payment API p99 latency above 10 seconds; card authorisations failing for some customers.',
    labels: ['incident', DEMO_LABEL],
  }));
}
