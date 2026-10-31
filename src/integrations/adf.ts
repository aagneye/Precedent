/** Minimal Atlassian Document Format helpers: read ADF as plain text, and build simple ADF documents. */

export interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: AdfNode[];
}

export interface AdfDoc {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'tableRow', 'panel', 'rule']);

export function adfToText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  const n = node as AdfNode;
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'hardBreak') return '\n';
  if (n.type === 'mention') return String(n.attrs?.text ?? '');
  if (n.type === 'inlineCard' || n.type === 'blockCard') return String(n.attrs?.url ?? '');
  const inner = (n.content ?? []).map(adfToText).join('');
  return BLOCKS.has(n.type) ? `${inner}\n` : inner;
}

export function text(value: string, marks?: AdfNode['marks']): AdfNode {
  return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };
}

export function link(value: string, href: string): AdfNode {
  return text(value, [{ type: 'link', attrs: { href } }]);
}

export function strong(value: string): AdfNode {
  return text(value, [{ type: 'strong' }]);
}

export function paragraph(...content: Array<AdfNode | string>): AdfNode {
  return { type: 'paragraph', content: content.map((c) => (typeof c === 'string' ? text(c) : c)) };
}

export function heading(level: number, value: string): AdfNode {
  return { type: 'heading', attrs: { level }, content: [text(value)] };
}

export function bulletList(items: Array<AdfNode[] | string>): AdfNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [typeof item === 'string' ? paragraph(item) : paragraph(...item)],
    })),
  };
}

export function doc(...content: AdfNode[]): AdfDoc {
  return { type: 'doc', version: 1, content };
}
