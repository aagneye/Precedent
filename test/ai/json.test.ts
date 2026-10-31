import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractJsonBlock, parseEach, parseJson } from '../../src/ai/json';

describe('extractJsonBlock', () => {
  it('finds JSON inside a fenced block', () => {
    expect(extractJsonBlock('Here you go:\n```json\n{"a":1}\n```\nThanks')).toBe('{"a":1}');
  });

  it('finds JSON surrounded by prose', () => {
    expect(extractJsonBlock('Sure! {"tags":["x"]} hope that helps')).toBe('{"tags":["x"]}');
    expect(extractJsonBlock('[1, 2, 3]')).toBe('[1, 2, 3]');
  });

  it('returns undefined without JSON', () => {
    expect(extractJsonBlock('no json here')).toBeUndefined();
  });
});

describe('parseJson', () => {
  const schema = z.object({ count: z.number() });

  it('validates against the schema', () => {
    expect(parseJson('{"count": 3}', schema)).toEqual({ ok: true, value: { count: 3 } });
  });

  it('reports schema and syntax errors', () => {
    const wrongType = parseJson('{"count": "three"}', schema);
    expect(wrongType.ok).toBe(false);
    const broken = parseJson('{"count": 3', schema);
    expect(broken.ok).toBe(false);
  });
});

describe('parseEach', () => {
  it('keeps only the valid items', () => {
    const schema = z.object({ key: z.string() });
    expect(parseEach([{ key: 'DEC-1' }, { key: 2 }, null, { key: 'DEC-2' }], schema)).toEqual([
      { key: 'DEC-1' },
      { key: 'DEC-2' },
    ]);
  });
});
