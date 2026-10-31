/**
 * Tags describe a decision's scope: services, technologies, vendors and policies.
 * Matching work to decisions starts with these, so normalization has to be stable.
 */

const ALIASES: Record<string, string> = {
  postgres: 'postgresql',
  pg: 'postgresql',
  psql: 'postgresql',
  mongo: 'mongodb',
  k8s: 'kubernetes',
  gql: 'graphql',
  'launch-darkly': 'launchdarkly',
  'feature-flag': 'feature-flags',
  'feature-flagging': 'feature-flags',
  multiregion: 'multi-region',
  'multi-regional': 'multi-region',
  'card-number': 'card-data',
  'card-numbers': 'card-data',
  'personal-data': 'pii',
  'http-clients': 'http-client',
  webhook: 'webhooks',
  retry: 'retries',
};

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could do does for from had has have how if in into is it its ' +
    'may might must no not of on or our out over should so some such than that the their them then there ' +
    'these they this those to too under up us use used using was we were what when where which while who ' +
    'why will with would you your all any also add adds added new make made need needs needed per via ' +
    'just only more most other same each both very about after before because between during until ' +
    'without within across again against once here further own off above below'
  ).split(' '),
);

const TOKEN = /[a-z0-9][a-z0-9.+#-]*/g;

export function normalizeTag(raw: string): string {
  const base = raw
    .toLowerCase()
    .trim()
    .replace(/^#/, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9.+-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return ALIASES[base] ?? base;
}

export function normalizeTags(raw: Iterable<string>, max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const tag = normalizeTag(value);
    if (!tag || tag.length > 60 || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

export function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(TOKEN) ?? [];
  return tokens
    .map((token) => token.replace(/[.+#-]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/** Tags from `vocabulary` that appear in `text`, either as a word or as a two-word phrase. */
export function extractTags(text: string, vocabulary: Iterable<string>): string[] {
  const known = new Set<string>();
  for (const tag of vocabulary) known.add(normalizeTag(tag));
  const words = tokenize(text);
  const found = new Set<string>();
  for (let i = 0; i < words.length; i += 1) {
    const single = normalizeTag(words[i]);
    if (known.has(single)) found.add(single);
    if (i + 1 < words.length) {
      const pair = normalizeTag(`${words[i]}-${words[i + 1]}`);
      if (known.has(pair)) found.add(pair);
    }
  }
  return [...found];
}

/** Distinctive words of a text, used for keyword matching when tags don't overlap. */
export function keywords(text: string, max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokenize(text)) {
    if (token.length < 3 || /^\d+$/.test(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}
