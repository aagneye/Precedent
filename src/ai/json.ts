import type { z } from 'zod';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** The JSON object or array in a model reply, ignoring prose and ``` fences around it. */
export function extractJsonBlock(text: string): string | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) return undefined;
  const close = body[start] === '{' ? '}' : ']';
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : undefined;
}

export function parseJson<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  const block = extractJsonBlock(text);
  if (!block) return { ok: false, error: 'No JSON found in model output' };
  let raw: unknown;
  try {
    raw = JSON.parse(block);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    error: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; '),
  };
}

/** Parses each array element on its own and keeps the valid ones, so one bad item doesn't sink the rest. */
export function parseEach<T>(items: unknown[], schema: z.ZodType<T>): T[] {
  const out: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
