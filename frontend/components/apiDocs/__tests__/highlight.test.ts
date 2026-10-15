import { describe, it, expect } from '@jest/globals';

import { tokenize } from '../highlight';

const kinds = (code: string, lang: string) => tokenize(code, lang).filter((token) => token.kind !== 'plain').map((token) => [token.kind, token.text]);

describe('tokenize', () => {
  it('tells JSON keys from values', () => {
    expect(kinds('{"kind": "invoice", "number": 1}', 'json')).toEqual([
      ['property', '"kind"'],
      ['string', '"invoice"'],
      ['property', '"number"'],
      ['number', '1'],
    ]);
  });

  it('marks Python comments and keywords', () => {
    expect(kinds('import hmac  # firma', 'python')).toEqual([
      ['keyword', 'import'],
      ['comment', '# firma'],
    ]);
  });

  it('marks curl flags', () => {
    expect(kinds('curl -X POST', 'bash')).toEqual([
      ['keyword', 'curl'],
      ['flag', '-X'],
    ]);
  });

  it('keeps the code text intact', () => {
    const code = 'const ts = String(Math.floor(Date.now() / 1000)) // segundos';

    expect(tokenize(code, 'javascript').map((token) => token.text).join('')).toBe(code);
  });
});
