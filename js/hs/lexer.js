// Bezztrátový lexer: tokens.map(t => t.text).join('') === src, i pro nevalidní vstup.

export const KEYWORDS = new Set([
  'case', 'class', 'data', 'default', 'deriving', 'do', 'else', 'if', 'import', 'in',
  'infix', 'infixl', 'infixr', 'instance', 'let', 'module', 'newtype', 'of', 'then', 'type', 'where',
]);

const SYM = '!#$%&*+./<=>?@\\^|-~:';
const isSym = (c) => c !== undefined && SYM.includes(c);
const isDigit = (c) => c >= '0' && c <= '9';
const reIdStart = /[\p{L}_]/u;
const reIdChar = /[\p{L}\p{N}_']/u;
const reUpper = /\p{Lu}/u;

const CHAR_RE = /'(?:[^'\\\n]|\\(?:[abfnrtv\\"']|\d+|x[0-9a-fA-F]+|o[0-7]+|\^[A-Z@[\\\]^_]|NUL|SOH|STX|ETX|EOT|ENQ|ACK|BEL|BS|HT|LF|VT|FF|CR|SO|SI|DLE|DC1|DC2|DC3|DC4|NAK|SYN|ETB|CAN|EM|SUB|ESC|FS|GS|RS|US|SP|DEL))'/y;
const NUM_RE = /0[xX][0-9a-fA-F]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

export function tokenize(src) {
  const toks = [];
  let i = 0, line = 1, col = 1;
  const n = src.length;

  const push = (type, end) => {
    const text = src.slice(i, end);
    toks.push({ type, text, start: i, end, line, col });
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (c === '\n') { line++; col = 1; }
      else if (c === '\t') col = col + 8 - ((col - 1) % 8);
      else if (c === '\r') { /* nulová šířka */ }
      else col++;
    }
    i = end;
  };

  while (i < n) {
    const c = src[i];
    if (c === '\n') { push('nl', i + 1); continue; }
    if (c === '\r') { push('nl', src[i + 1] === '\n' ? i + 2 : i + 1); continue; }
    if (c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === ' ') {
      let j = i + 1;
      while (j < n && (src[j] === ' ' || src[j] === '\t' || src[j] === '\f' || src[j] === '\v' || src[j] === ' ')) j++;
      push('ws', j); continue;
    }
    if (c === '{' && src[i + 1] === '-') {
      let depth = 1, j = i + 2;
      while (j < n && depth > 0) {
        if (src[j] === '{' && src[j + 1] === '-') { depth++; j += 2; }
        else if (src[j] === '-' && src[j + 1] === '}') { depth--; j += 2; }
        else j++;
      }
      push('comment', j); continue;
    }
    if (c === '-' && src[i + 1] === '-') {
      let j = i;
      while (src[j] === '-') j++;
      if (!isSym(src[j])) {
        while (j < n && src[j] !== '\n' && src[j] !== '\r') j++;
        push('comment', j); continue;
      }
    }
    if (reIdStart.test(c)) {
      let j = i + 1;
      while (j < n && reIdChar.test(src[j])) j++;
      const text = src.slice(i, j);
      if (reUpper.test(c)) push('con', j);
      else push(KEYWORDS.has(text) ? 'kw' : 'id', j);
      continue;
    }
    if (isDigit(c)) {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src);
      push('num', i + m[0].length); continue;
    }
    if (c === "'") {
      CHAR_RE.lastIndex = i;
      const m = CHAR_RE.exec(src);
      if (m) { push('char', i + m[0].length); continue; }
      push('err', i + 1); continue;
    }
    if (c === '"') {
      let j = i + 1, ok = false;
      while (j < n) {
        const d = src[j];
        if (d === '"') { ok = true; j++; break; }
        if (d === '\n' || d === '\r') break;
        if (d === '\\') {
          // mezera v řetězci: \  ...  \  (může přes řádky)
          let k = j + 1;
          if (k < n && /\s/.test(src[k])) {
            while (k < n && /\s/.test(src[k])) k++;
            if (src[k] === '\\') { j = k + 1; continue; }
            break;
          }
          j += 2; continue;
        }
        j++;
      }
      push(ok ? 'str' : 'err', j); continue;
    }
    if ('()[],;{}`'.includes(c)) { push('punct', i + 1); continue; }
    if (isSym(c)) {
      let j = i + 1;
      while (j < n && isSym(src[j])) j++;
      push('op', j); continue;
    }
    push('err', i + 1);
  }
  return toks;
}

const ASCII_NAMES = {
  NUL: 0, SOH: 1, STX: 2, ETX: 3, EOT: 4, ENQ: 5, ACK: 6, BEL: 7, BS: 8, HT: 9, LF: 10, VT: 11,
  FF: 12, CR: 13, SO: 14, SI: 15, DLE: 16, DC1: 17, DC2: 18, DC3: 19, DC4: 20, NAK: 21, SYN: 22,
  ETB: 23, CAN: 24, EM: 25, SUB: 26, ESC: 27, FS: 28, GS: 29, RS: 30, US: 31, SP: 32, DEL: 127,
};
const SIMPLE_ESC = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, '\\': 92, '"': 34, "'": 39 };

// Dekóduje tělo literálu (bez uvozovek) na pole znaků (JS řetězce po jednom code pointu).
export function decodeEscapes(body) {
  const out = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    const c = body[i];
    if (c !== '\\') {
      const cp = body.codePointAt(i);
      out.push(String.fromCodePoint(cp));
      i += cp > 0xffff ? 2 : 1;
      continue;
    }
    i++;
    const d = body[i];
    if (d === undefined) break;
    if (d in SIMPLE_ESC) { out.push(String.fromCodePoint(SIMPLE_ESC[d])); i++; continue; }
    if (d === '&') { i++; continue; }
    if (/\s/.test(d)) { // mezera
      while (i < n && body[i] !== '\\') i++;
      i++; continue;
    }
    if (d === '^') { out.push(String.fromCodePoint(body.charCodeAt(i + 1) - 64)); i += 2; continue; }
    if (isDigit(d)) {
      let j = i; while (j < n && isDigit(body[j])) j++;
      out.push(String.fromCodePoint(Math.min(parseInt(body.slice(i, j), 10), 0x10ffff))); i = j; continue;
    }
    if (d === 'x') {
      let j = i + 1; while (j < n && /[0-9a-fA-F]/.test(body[j])) j++;
      out.push(String.fromCodePoint(Math.min(parseInt(body.slice(i + 1, j), 16), 0x10ffff))); i = j; continue;
    }
    if (d === 'o') {
      let j = i + 1; while (j < n && /[0-7]/.test(body[j])) j++;
      out.push(String.fromCodePoint(Math.min(parseInt(body.slice(i + 1, j), 8), 0x10ffff))); i = j; continue;
    }
    let matched = false;
    for (const len of [3, 2]) {
      const name = body.slice(i, i + len);
      if (name in ASCII_NAMES) { out.push(String.fromCodePoint(ASCII_NAMES[name])); i += len; matched = true; break; }
    }
    if (!matched) { out.push(d); i++; }
  }
  return out;
}
