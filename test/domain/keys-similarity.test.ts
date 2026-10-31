import { describe, expect, it } from 'vitest';
import { findDecisionKeys, formatDecisionKey, parseDecisionKey } from '../../src/domain/keys';
import { isNearDuplicate, jaccard } from '../../src/domain/similarity';

describe('decision keys', () => {
  it('formats and parses keys', () => {
    expect(formatDecisionKey(7)).toBe('DEC-7');
    expect(parseDecisionKey('dec-12')).toBe(12);
    expect(parseDecisionKey('PAY-12')).toBeUndefined();
  });

  it('finds keys mentioned in text', () => {
    expect(findDecisionKeys('Conflicts with dec-3 and DEC-3, see also DEC-10.')).toEqual(['DEC-3', 'DEC-10']);
  });
});

describe('similarity', () => {
  it('scores identical texts as 1 and disjoint texts as 0', () => {
    expect(jaccard('ledger stays on postgresql', 'Ledger stays on PostgreSQL')).toBe(1);
    expect(jaccard('ledger stays on postgresql', 'mobile supports android')).toBe(0);
  });

  it('flags near-duplicate decision statements', () => {
    expect(
      isNearDuplicate(
        'All outbound HTTP calls go through acme-http',
        'All outbound HTTP calls must go through acme-http',
      ),
    ).toBe(true);
    expect(isNearDuplicate('Use Kafka for events', 'Use PostgreSQL for the ledger')).toBe(false);
  });
});
