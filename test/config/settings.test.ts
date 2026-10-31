import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, reviewProjectFor, sanitizeSettings } from '../../src/config/settings';

describe('sanitizeSettings', () => {
  it('keeps well-formed fields and normalizes project keys', () => {
    expect(
      sanitizeSettings({
        confluenceSpaceIds: ['123', 456, ''],
        jiraProjectKeys: ['pay', 'not a key', 'OPS'],
        reviewProjectKey: 'pay',
        ai: { harvest: false, guard: 'yes' },
        monthlyTokenBudget: '1500000.7',
        adminAccountId: 'should-be-ignored',
      }),
    ).toEqual({
      confluenceSpaceIds: ['123'],
      jiraProjectKeys: ['PAY', 'OPS'],
      reviewProjectKey: 'PAY',
      ai: { harvest: false, guard: true },
      monthlyTokenBudget: 1500000,
    });
  });

  it('clears the review project and rejects nonsense', () => {
    expect(sanitizeSettings({ reviewProjectKey: '' })).toEqual({ reviewProjectKey: undefined });
    expect(sanitizeSettings({ monthlyTokenBudget: -5 })).toEqual({});
    expect(sanitizeSettings('nope')).toEqual({});
  });
});

describe('reviewProjectFor', () => {
  it('prefers the configured project, then the first scanned one, then the demo project', () => {
    expect(reviewProjectFor({ ...DEFAULT_SETTINGS, reviewProjectKey: 'OPS', jiraProjectKeys: ['PAY'] })).toBe('OPS');
    expect(reviewProjectFor({ ...DEFAULT_SETTINGS, jiraProjectKeys: ['PAY'] })).toBe('PAY');
    expect(
      reviewProjectFor({
        ...DEFAULT_SETTINGS,
        demo: { projectKey: 'ACME', issueKeys: [], pageIds: [], loadedAt: '2026-11-01' },
      }),
    ).toBe('ACME');
    expect(reviewProjectFor(DEFAULT_SETTINGS)).toBeUndefined();
  });
});
