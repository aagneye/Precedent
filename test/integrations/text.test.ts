import { describe, expect, it } from 'vitest';
import { adfToText, bulletList, doc, heading, link, paragraph } from '../../src/integrations/adf';
import { escapeXml, storageToText } from '../../src/integrations/storageFormat';

describe('adfToText', () => {
  it('flattens paragraphs, lists, mentions and breaks', () => {
    const body = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'We agreed with ' }, { type: 'mention', attrs: { text: '@Maya' } }, { type: 'text', text: '.' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Use acme-http' }] }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'line one' }, { type: 'hardBreak' }, { type: 'text', text: 'line two' }] },
      ],
    };
    expect(adfToText(body)).toBe('We agreed with @Maya.\nUse acme-http\n\nline one\nline two\n');
  });

  it('handles plain strings and empty input', () => {
    expect(adfToText('plain')).toBe('plain');
    expect(adfToText(undefined)).toBe('');
  });

  it('round-trips the builders', () => {
    const built = doc(heading(2, 'Decision review'), paragraph('See ', link('DEC-2', 'https://x')), bulletList(['a', 'b']));
    expect(adfToText(built)).toBe('Decision review\nSee DEC-2\na\n\nb\n\n');
  });
});

describe('storageToText', () => {
  it('keeps block boundaries and decodes entities', () => {
    const storage =
      '<h2>Decision</h2><p>We keep the ledger on PostgreSQL &amp; never on MongoDB.</p><ul><li>ACID&nbsp;guarantees</li><li>Team skills</li></ul>' +
      '<ac:structured-macro ac:name="info"><ac:parameter ac:name="title">ignored</ac:parameter><ac:rich-text-body><p>Owner: Maya</p></ac:rich-text-body></ac:structured-macro>';
    expect(storageToText(storage)).toBe(
      'Decision\nWe keep the ledger on PostgreSQL & never on MongoDB.\nACID guarantees\nTeam skills\nOwner: Maya',
    );
  });

  it('escapes text for storage format', () => {
    expect(escapeXml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
  });
});
