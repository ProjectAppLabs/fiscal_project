/**
 * A small syntax highlighter for the docs' examples (Python, JavaScript, JSON, bash and HTTP): enough to read code at a
 * glance without a dependency. It splits code into tokens and never interprets it.
 */

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'property' | 'flag';
export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS: Record<string, string[]> = {
  python: ['import', 'from', 'def', 'return', 'if', 'else', 'elif', 'for', 'in', 'not', 'and', 'or', 'with', 'as', 'try', 'except', 'raise', 'True', 'False', 'None', 'lambda', 'class'],
  javascript: ['import', 'from', 'export', 'function', 'return', 'if', 'else', 'for', 'of', 'const', 'let', 'await', 'async', 'new', 'true', 'false', 'null', 'undefined', 'throw', 'try', 'catch'],
  json: ['true', 'false', 'null'],
  bash: ['curl', 'export', 'echo'],
  http: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HTTP'],
};

const STRING = String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`';
const NUMBER = String.raw`\b\d+(?:\.\d+)?\b`;

function pattern(lang: string): RegExp {
  const comment = lang === 'javascript' ? String.raw`\/\/[^\n]*` : lang === 'json' || lang === 'http' ? String.raw`(?!x)x` : String.raw`#[^\n]*`;
  const words = (KEYWORDS[lang] ?? []).join('|') || String.raw`(?!x)x`;
  const flag = lang === 'bash' ? String.raw`(?<=\s)-{1,2}[A-Za-z][\w-]*` : String.raw`(?!x)x`;
  return new RegExp(`(${comment})|(${STRING})(\\s*:)?|(${NUMBER})|\\b(${words})\\b|(${flag})`, 'g');
}

export function tokenize(code: string, lang: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of code.matchAll(pattern(lang))) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: 'plain', text: code.slice(last, index) });
    const [whole, comment, string, colon, number, keyword, flag] = match;
    if (comment) tokens.push({ kind: 'comment', text: comment });
    else if (string) {
      tokens.push({ kind: colon && (lang === 'json' || lang === 'javascript') ? 'property' : 'string', text: string });
      if (colon) tokens.push({ kind: 'plain', text: colon });
    } else if (number) tokens.push({ kind: 'number', text: number });
    else if (keyword) tokens.push({ kind: 'keyword', text: keyword });
    else if (flag) tokens.push({ kind: 'flag', text: flag });
    else tokens.push({ kind: 'plain', text: whole });
    last = index + whole.length;
  }
  if (last < code.length) tokens.push({ kind: 'plain', text: code.slice(last) });
  return tokens;
}
