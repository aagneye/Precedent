import { describe, expect, it } from 'vitest';
import { extractTags, keywords, normalizeTag, normalizeTags, tokenize } from '../../src/domain/tags';

describe('normalizeTag', () => {
  it('lower-cases, hyphenates and resolves aliases', () => {
    expect(normalizeTag('PostgreSQL')).toBe('postgresql');
    expect(normalizeTag('Postgres')).toBe('postgresql');
    expect(normalizeTag('#Feature Flag')).toBe('feature-flags');
    expect(normalizeTag('  Ledger_Service ')).toBe('ledger-service');
    expect(normalizeTag('acme-http')).toBe('acme-http');
  });

  it('drops punctuation at the edges', () => {
    expect(normalizeTag('--kafka--')).toBe('kafka');
    expect(normalizeTag('node.js.')).toBe('node.js');
  });
});

describe('normalizeTags', () => {
  it('de-duplicates after normalization and caps the count', () => {
    expect(normalizeTags(['Mongo', 'mongodb', 'MongoDB', ''])).toEqual(['mongodb']);
    expect(normalizeTags(['a1', 'b2', 'c3'], 2)).toEqual(['a1', 'b2']);
  });
});

describe('tokenize', () => {
  it('keeps hyphenated identifiers and removes stopwords', () => {
    expect(tokenize('We will use the acme-http client for all retries.')).toEqual([
      'acme-http',
      'client',
      'retries',
    ]);
  });
});

describe('extractTags', () => {
  const vocabulary = ['postgresql', 'mongodb', 'multi-region', 'launchdarkly', 'acme-http'];

  it('finds known tags as words, aliases and two-word phrases', () => {
    const text = 'Migrate the ledger from Postgres to Mongo and go multi region; drop Launch Darkly.';
    expect(extractTags(text, vocabulary).sort()).toEqual(['launchdarkly', 'mongodb', 'multi-region', 'postgresql']);
  });

  it('ignores words outside the vocabulary', () => {
    expect(extractTags('Refactor the onboarding email copy', vocabulary)).toEqual([]);
  });
});

describe('keywords', () => {
  it('returns distinctive words without numbers or duplicates', () => {
    expect(keywords('Retry retry payout webhooks 3 times with backoff')).toEqual([
      'retry',
      'payout',
      'webhooks',
      'times',
      'backoff',
    ]);
  });
});
