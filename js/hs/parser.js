// Parser podmnožiny Haskellu. Layout se řeší přes sloupce tokenů: token na začátku řádku
// se sloupcem <= sloupec aktuálního implicitního bloku ukončuje položku/blok.

import { tokenize, decodeEscapes } from './lexer.js';
import { HsError } from './errors.js';

const RESERVED_OPS = new Set(['..', '::', '=', '\\', '|', '<-', '->', '@', '~', '=>']);

export const DEFAULT_FIXITY = {
  '.': [9, 'r'], '!!': [9, 'l'],
  '^': [8, 'r'], '^^': [8, 'r'], '**': [8, 'r'],
  '*': [7, 'l'], '/': [7, 'l'], div: [7, 'l'], mod: [7, 'l'], rem: [7, 'l'], quot: [7, 'l'],
  '+': [6, 'l'], '-': [6, 'l'],
  ':': [5, 'r'], '++': [5, 'r'],
  '==': [4, 'n'], '/=': [4, 'n'], '<': [4, 'n'], '<=': [4, 'n'], '>': [4, 'n'], '>=': [4, 'n'],
  elem: [4, 'n'], notElem: [4, 'n'],
  '&&': [3, 'r'], '||': [2, 'r'],
  '>>': [1, 'l'], '>>=': [1, 'l'],
  '$': [0, 'r'], '$!': [0, 'r'], seq: [0, 'r'],
};

const ASSOC_NAME = { l: 'infixl', r: 'infixr', n: 'infix' };

export function prepTokens(src) {
  const all = tokenize(src);
  const toks = [];
  let lastLine = 0;
  for (const t of all) {
    if (t.type === 'ws' || t.type === 'nl' || t.type === 'comment') continue;
    toks.push({ ...t, bol: t.line !== lastLine });
    lastLine = t.line;
  }
  // pozice konce vstupu
  let line = 1, col = 1;
  for (const t of all) {
    for (const c of t.text) {
      if (c === '\n') { line++; col = 1; } else if (c !== '\r') col++;
    }
  }
  toks.push({ type: 'eof', text: '', start: src.length, end: src.length, line, col, bol: true });
  return { toks, all };
}

function scanFixities(toks, base) {
  const fix = Object.assign(Object.create(null), base);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === 'kw' && (t.text === 'infixl' || t.text === 'infixr' || t.text === 'infix')) {
      const assoc = t.text === 'infixl' ? 'l' : t.text === 'infixr' ? 'r' : 'n';
      let j = i + 1, prec = 9;
      if (toks[j] && toks[j].type === 'num') { prec = parseInt(toks[j].text, 10); j++; }
      while (toks[j]) {
        if (toks[j].type === 'op') { fix[toks[j].text] = [prec, assoc]; j++; }
        else if (toks[j].text === '`' && toks[j + 1] && toks[j + 2] && toks[j + 2].text === '`') { fix[toks[j + 1].text] = [prec, assoc]; j += 3; }
        else break;
        if (toks[j] && toks[j].text === ',') j++; else break;
      }
    }
  }
  return fix;
}

const STOPPING_EXPR = new Set(['lam', 'let', 'if', 'case']);

export class Parser {
  constructor(src, opts = {}) {
    this.src = src;
    const { toks } = prepTokens(src);
    this.toks = toks;
    this.i = 0;
    this.fix = scanFixities(toks, opts.fixities || DEFAULT_FIXITY);
    this.ctx = [];
    this.lastEnd = 0;
  }

  // ---------- tokeny ----------
  peek(k = 0) { return this.toks[Math.min(this.i + k, this.toks.length - 1)]; }
  next() {
    const t = this.toks[this.i];
    if (t.type !== 'eof') { this.i++; this.lastEnd = t.end; }
    return t;
  }
  stopped(t = this.peek()) {
    if (t.type === 'eof') return true;
    const c = this.ctx[this.ctx.length - 1];
    return !!(c && !c.explicit && t.bol && t.col <= c.col && t !== c.startTok);
  }
  is(text, t = this.peek()) {
    return !this.stopped(t) && (t.type === 'op' || t.type === 'punct' || t.type === 'kw') && t.text === text;
  }
  isAny(texts, t = this.peek()) { return texts.some((x) => this.is(x, t)); }
  fail(t = this.peek(), hint) {
    if (this.stopped(t)) {
      throw new HsError('parse', 'parse error (possibly incorrect indentation or mismatched brackets)', {
        line: t.line, col: t.col, hint: hint || hintForStop(t),
      });
    }
    throw new HsError('parse', `parse error on input ‘${t.text}’`, { line: t.line, col: t.col, hint: hint || hintForToken(t) });
  }
  expect(text, hint) {
    if (this.is(text)) return this.next();
    if (!hint && (text === ')' || text === ']')) {
      const t = this.peek();
      hint = this.stopped(t) || t.type === 'eof'
        ? `Chybí zavírací závorka ${text}.`
        : `Tady se čekala zavírací závorka ${text}. Nesedí závorky, nebo chybí operátor či čárka.`;
    }
    this.fail(this.peek(), hint);
  }
  mk(t, props, startTok) {
    return Object.assign({ t, start: startTok.start, end: this.lastEnd, line: startTok.line, col: startTok.col }, props);
  }

  // ---------- bloky ----------
  block(itemFn) {
    if (this.is('{')) {
      this.next();
      this.ctx.push({ explicit: true });
      const items = [];
      while (!this.is('}')) {
        if (this.is(';')) { this.next(); continue; }
        items.push(itemFn());
        if (this.is(';')) this.next();
        else if (!this.is('}')) this.fail();
      }
      this.ctx.pop();
      this.next();
      return items;
    }
    const first = this.peek();
    if (this.stopped(first)) return [];
    const col = first.col;
    const ctx = { col, explicit: false, startTok: null };
    this.ctx.push(ctx);
    const items = [];
    try {
      for (;;) {
        if (this.is(';')) { this.next(); continue; }
        const t0 = this.peek();
        if (t0.type === 'eof') break;
        if (t0.bol && t0.col < col) break;
        ctx.startTok = t0;
        items.push(itemFn());
        const t = this.peek();
        if (t.type === 'eof') break;
        if (this.is(';')) { this.next(); continue; }
        if (t.bol && t.col === col) continue;
        if (t.bol && t.col < col) break;
        if (t.bol && t.col > col) this.fail(t);
        break; // parse-error(t): implicitní blok se zavře
      }
    } finally {
      this.ctx.pop();
    }
    return items;
  }

  // ---------- modul ----------
  parseModule() {
    if (this.peek().type === 'kw' && this.peek().text === 'module') {
      while (!(this.peek().type === 'kw' && this.peek().text === 'where') && this.peek().type !== 'eof') this.next();
      if (this.peek().type === 'eof') this.fail();
      this.next();
    }
    const decls = this.block(() => this.parseDecl(true));
    if (this.peek().type !== 'eof') this.fail(this.peek());
    return groupClauses(decls);
  }

  parseExprOnly() {
    const e = this.parseExp();
    if (this.peek().type !== 'eof') this.fail(this.peek());
    return e;
  }

  // ---------- deklarace ----------
  parseDecl(top) {
    const t = this.peek();
    if (t.type === 'kw') {
      if (t.text === 'import' && top) {
        const s = this.next();
        while (!this.stopped() && !this.is(';')) this.next();
        return this.mk('import', {}, s);
      }
      if (t.text === 'infixl' || t.text === 'infixr' || t.text === 'infix') {
        const s = this.next();
        while (!this.stopped() && !this.is(';')) this.next();
        return this.mk('fixity', {}, s);
      }
      if (['data', 'type', 'class', 'instance', 'newtype', 'deriving', 'default'].includes(t.text)) {
        throw new HsError('parse', `‘${t.text}’ declarations are not supported`, {
          line: t.line, col: t.col, hint: `Deklarace ${t.text} tenhle trenažér nepodporuje. Stačí funkce a výrazy z cvičení.`,
        });
      }
      if (t.text === 'do') {
        throw new HsError('parse', 'do-notation is not supported', { line: t.line, col: t.col, hint: 'Blok do (IO) tenhle trenažér nepodporuje.' });
      }
    }
    // typová signatura?
    if (this.looksLikeSig()) return this.parseSig();
    return this.parseBinding(top);
  }

  looksLikeSig() {
    let k = 0;
    for (;;) {
      const t = this.peek(k);
      if (t.type === 'id' && t.text !== '_') k++;
      else if (t.text === '(' && this.peek(k + 1).type === 'op' && this.peek(k + 2).text === ')') k += 3;
      else return false;
      const u = this.peek(k);
      if (u.type === 'op' && u.text === '::') return !this.stopped(u);
      if (u.text === ',') { k++; continue; }
      return false;
    }
  }

  parseSig() {
    const s = this.peek();
    const names = [];
    for (;;) {
      const t = this.next();
      if (t.text === '(') { names.push(this.next().text); this.next(); } else names.push(t.text);
      if (this.is(',')) { this.next(); continue; }
      break;
    }
    this.expect('::');
    const sig = this.parseSigType();
    return this.mk('sig', { names, sig }, s);
  }

  parseBinding(top) {
    const s = this.peek();
    // operátor definovaný prefixově: (<+>) a b = ...
    if (this.is('(') && this.peek(1).type === 'op' && !RESERVED_OPS.has(this.peek(1).text) && this.peek(2).text === ')') {
      this.next(); const op = this.next().text; this.next();
      const pats = [];
      while (!this.isAny(['=', '|']) && !this.stopped()) pats.push(this.parseAPat());
      return this.finishFun(op, pats, s);
    }
    const items = [];
    while (!this.stopped() && !this.isAny(['=', '|'])) {
      const t = this.peek();
      if (t.type === 'op' && !RESERVED_OPS.has(t.text)) {
        this.next();
        items.push({ op: t.text, tok: t, con: t.text.startsWith(':') });
      } else if (t.text === '`') {
        this.next(); const n = this.next(); this.expect('`');
        items.push({ op: n.text, tok: n, con: n.type === 'con' });
      } else if (t.type === 'op' && (t.text === '@' || t.text === '::')) {
        this.fail(t);
      } else {
        items.push({ pat: this.parseAPat() });
      }
    }
    if (items.length === 0) this.fail(this.peek());
    const varOps = items.filter((x) => x.op && !x.con);
    if (varOps.length === 1) {
      const k = items.indexOf(varOps[0]);
      const left = this.itemsToPat(items.slice(0, k), s);
      const right = this.itemsToPat(items.slice(k + 1), s);
      return this.finishFun(varOps[0].op, [left, right], s);
    }
    if (varOps.length > 1) this.fail(varOps[1].tok);
    const hasCons = items.some((x) => x.op);
    const first = items[0];
    if (!hasCons && first.pat && first.pat.t === 'pvar') {
      return this.finishFun(first.pat.name, items.slice(1).map((x) => x.pat), s);
    }
    if (hasCons && first.pat && first.pat.t === 'pvar' && items[1] && items[1].pat) {
      throw new HsError('parse', `Parse error in pattern: ${first.pat.name}`, {
        line: s.line, col: s.col,
        hint: 'Vzor se seznamem musí být v závorkách: místo f x:xs = … piš f (x:xs) = …',
      });
    }
    const pat = this.itemsToPat(items, s);
    return this.finishPatBind(pat, s);
  }

  itemsToPat(items, s) {
    // items: střídání vzorů a konstruktorových operátorů (:)
    const parts = [];
    let cur = [];
    for (const it of items) {
      if (it.op) {
        if (!it.con) this.fail(it.tok);
        parts.push(cur); parts.push(it); cur = [];
      } else cur.push(it.pat);
    }
    parts.push(cur);
    const toPat = (ps) => {
      if (ps.length === 0) this.fail(this.peek());
      if (ps.length === 1) return ps[0];
      const h = ps[0];
      if (h.t === 'pcon' && h.args.length === 0) return { ...h, args: ps.slice(1), end: ps[ps.length - 1].end };
      throw new HsError('parse', `Parse error in pattern: ${patText(this.src, h)}`, {
        line: h.line, col: h.col,
        hint: 'Tohle není platný vzor. Název funkce musí být první a argumenty se seznamy dej do závorek, např. f (x:xs).',
      });
    };
    // pravá asociativita (:)
    let acc = toPat(parts[parts.length - 1]);
    for (let k = parts.length - 3; k >= 0; k -= 2) {
      const left = toPat(parts[k]);
      acc = { t: 'pcon', name: parts[k + 1].op, args: [left, acc], start: left.start, end: acc.end, line: left.line, col: left.col };
    }
    return acc;
  }

  finishFun(name, pats, s) {
    const rhs = this.parseRhs('=');
    const where = this.parseWhere();
    const clause = { pats, rhs, where, line: s.line, col: s.col, start: s.start };
    return this.mk('fun', { name, clauses: [clause] }, s);
  }

  finishPatBind(pat, s) {
    const rhs = this.parseRhs('=');
    const where = this.parseWhere();
    return this.mk('pbind', { pat, rhs, where }, s);
  }

  parseWhere() {
    if (this.peek().type === 'kw' && this.peek().text === 'where' && !this.stopped()) {
      this.next();
      return groupClauses(this.block(() => this.parseDecl(false)));
    }
    return null;
  }

  parseRhs(eqTok) {
    const s = this.peek();
    if (this.is('|')) {
      const guards = [];
      while (this.is('|')) {
        const gs = this.next();
        let cond = this.parseExp();
        while (this.is(',')) {
          this.next();
          const c2 = this.parseExp();
          cond = { t: 'binop', op: { name: '&&', start: c2.start, end: c2.start, line: c2.line, col: c2.col }, l: cond, r: c2, start: cond.start, end: c2.end, line: cond.line, col: cond.col };
        }
        if (!this.is(eqTok)) {
          const t = this.peek();
          this.fail(t, eqTok === '=' && t.text === '->' ? 'Ve stráži funkce se po podmínce píše =, šipka -> je jen v case.' : `Za podmínkou stráže chybí ${eqTok}.`);
        }
        this.next();
        const body = this.parseExp();
        guards.push({ cond, body, line: gs.line, col: gs.col });
      }
      return { t: 'guarded', guards, line: s.line, col: s.col };
    }
    if (!this.is(eqTok)) {
      const t = this.peek();
      let hint = '';
      if (eqTok === '=' && t.text === '->') hint = 'V definici funkce se píše =, šipka -> patří do lambdy nebo case.';
      else if (eqTok === '->' && t.text === '=') hint = 'V alternativě case se píše ->, ne =.';
      else if (eqTok === '=' && (this.stopped(t) || t.type === 'eof')) hint = 'Chybí = a pravá strana definice. Do souboru patří jen definice (f x = …); samotné výrazy zkoušej v konzoli.';
      else if (eqTok === '=' && t.text === '==') hint = 'V definici se píše jedno =, dvě == jsou porovnání.';
      this.fail(t, hint);
    }
    this.next();
    const body = this.parseExp();
    return { t: 'plain', body, line: s.line, col: s.col };
  }

  // ---------- typy ----------
  parseSigType() {
    const s = this.peek();
    const t = this.parseType();
    if (this.is('=>')) {
      this.next();
      const ctx = typeToContext(t, s);
      const ty = this.parseType();
      return { ctx, type: ty };
    }
    return { ctx: [], type: t };
  }
  parseType() {
    const b = this.parseBType();
    if (this.is('->')) { this.next(); const r = this.parseType(); return { t: 'tfun', a: b, b: r }; }
    return b;
  }
  parseBType() {
    const a = this.parseAType();
    const args = [];
    while (!this.stopped() && this.startsAType()) args.push(this.parseAType());
    return args.length ? { t: 'tapp', f: a, args } : a;
  }
  startsAType(t = this.peek()) {
    return t.type === 'id' || t.type === 'con' || (t.type === 'punct' && (t.text === '(' || t.text === '['));
  }
  parseAType() {
    const t = this.peek();
    if (this.stopped(t)) this.fail(t);
    if (t.type === 'id') { this.next(); return { t: 'tvar', name: t.text, line: t.line, col: t.col }; }
    if (t.type === 'con') { this.next(); return { t: 'tcon', name: t.text, line: t.line, col: t.col }; }
    if (this.is('(')) {
      this.next();
      if (this.is(')')) { this.next(); return { t: 'tcon', name: '()', line: t.line, col: t.col }; }
      const first = this.parseType();
      if (this.is(',')) {
        const items = [first];
        while (this.is(',')) { this.next(); items.push(this.parseType()); }
        this.expect(')');
        return { t: 'ttuple', items };
      }
      this.expect(')');
      return first;
    }
    if (this.is('[')) {
      this.next();
      const el = this.parseType();
      this.expect(']');
      return { t: 'tlist', el };
    }
    this.fail(t);
  }

  // ---------- vzory ----------
  startsAPat(t = this.peek()) {
    if (this.stopped(t)) return false;
    return t.type === 'id' || t.type === 'con' || t.type === 'num' || t.type === 'char' || t.type === 'str' ||
      (t.type === 'punct' && (t.text === '(' || t.text === '['));
  }
  parseAPat() {
    const t = this.peek();
    if (this.stopped(t)) this.fail(t);
    if (t.type === 'id') {
      this.next();
      if (t.text === '_') return this.mk('pwild', {}, t);
      if (this.peek().type === 'op' && this.peek().text === '@' && !this.stopped()) {
        this.next();
        const p = this.parseAPat();
        return this.mk('pas', { name: t.text, pat: p }, t);
      }
      return this.mk('pvar', { name: t.text }, t);
    }
    if (t.type === 'con') { this.next(); return this.mk('pcon', { name: t.text, args: [] }, t); }
    if (t.type === 'num' || t.type === 'char' || t.type === 'str') { this.next(); return this.mk('plit', { lit: litOf(t) }, t); }
    if (this.is('(')) {
      this.next();
      if (this.is(')')) { this.next(); return this.mk('pcon', { name: '()', args: [] }, t); }
      if (this.is('-') && this.peek(1).type === 'num') {
        this.next(); const nt = this.next();
        this.expect(')');
        return this.mk('plit', { lit: negLit(litOf(nt)) }, t);
      }
      const p = this.parsePat();
      if (this.is(',')) {
        const items = [p];
        while (this.is(',')) { this.next(); items.push(this.parsePat()); }
        this.expect(')');
        return this.mk('ptuple', { items }, t);
      }
      this.expect(')');
      return { ...p, start: t.start, end: this.lastEnd, line: t.line, col: t.col, parens: true };
    }
    if (this.is('[')) {
      this.next();
      const items = [];
      if (!this.is(']')) {
        items.push(this.parsePat());
        while (this.is(',')) { this.next(); items.push(this.parsePat()); }
      }
      this.expect(']');
      return this.mk('plist', { items }, t);
    }
    if (t.type === 'op' && t.text === '-' && this.peek(1).type === 'num') {
      this.fail(t, 'Záporné číslo ve vzoru dej do závorek: f (-1) = …');
    }
    this.fail(t);
  }
  parsePat() {
    const s = this.peek();
    let left;
    if (this.is('-') && this.peek(1).type === 'num') {
      this.next(); const nt = this.next();
      left = this.mk('plit', { lit: negLit(litOf(nt)) }, s);
    } else if (s.type === 'con') {
      this.next();
      const args = [];
      while (this.startsAPat()) args.push(this.parseAPat());
      left = this.mk('pcon', { name: s.text, args }, s);
    } else left = this.parseAPat();
    if (this.is(':')) {
      this.next();
      const right = this.parsePat();
      return { t: 'pcon', name: ':', args: [left, right], start: left.start, end: right.end, line: left.line, col: left.col };
    }
    return left;
  }

  // ---------- výrazy ----------
  parseExp() {
    const e = this.parseInfix(false).e;
    if (this.is('::')) {
      this.next();
      const sig = this.parseSigType();
      return { t: 'ann', e, sig, start: e.start, end: this.lastEnd, line: e.line, col: e.col };
    }
    return e;
  }

  isInfixOpTok(t = this.peek()) {
    if (this.stopped(t)) return false;
    if (t.type === 'op') return !RESERVED_OPS.has(t.text);
    return t.type === 'punct' && t.text === '`';
  }

  parseOpTok() {
    const t = this.next();
    if (t.text === '`') {
      const n = this.next();
      if (n.type !== 'id' && n.type !== 'con') this.fail(n);
      const close = this.peek();
      if (!this.is('`')) this.fail(close);
      this.next();
      return { name: n.text, start: t.start, end: close.end, line: t.line, col: t.col, backtick: true };
    }
    return { name: t.text, start: t.start, end: t.end, line: t.line, col: t.col };
  }

  parseInfix(allowTrailing) {
    const items = [];
    for (;;) {
      const t = this.peek();
      if (this.stopped(t)) this.fail(t, items.length ? 'Za operátorem chybí operand.' : undefined);
      if (t.type === 'op' && t.text === '-') {
        this.next();
        items.push({ neg: true, tok: t });
        continue;
      }
      const e = this.parseExp10();
      items.push(e);
      if (STOPPING_EXPR.has(e.t)) break;
      if (this.isInfixOpTok()) {
        const op = this.parseOpTok();
        if (allowTrailing && this.is(')')) return { e: this.resolve(items), trailing: op };
        items.push({ op });
        continue;
      }
      break;
    }
    return { e: this.resolve(items) };
  }

  fixity(name) { return this.fix[name] || [9, 'l']; }

  resolve(items) {
    if (items.length === 1 && !items[0].neg) return items[0];
    let pos = 0;
    const self = this;
    const opInfo = (it) => { const [p, a] = self.fixity(it.op.name); return { prec: p, assoc: a, op: it.op }; };
    const precErr = (o1, o2) => {
      const d1 = o1.neg ? 'prefix ‘-’' : `‘${o1.op.name}’`;
      const d2 = o2.neg ? 'prefix ‘-’' : `‘${o2.op.name}’`;
      const at = o2.op || o2.tok || o1.op;
      throw new HsError('parse', `Precedence parsing error: cannot mix ${d1} [${ASSOC_NAME[o1.assoc]} ${o1.prec}] and ${d2} [${ASSOC_NAME[o2.assoc]} ${o2.prec}] in the same infix expression`, {
        line: at.line, col: at.col,
        hint: o2.neg || o1.neg
          ? 'Záporné číslo za operátorem dej do závorek, např. 2 * (-3).'
          : 'Tyto operátory nejdou řetězit bez závorek. Např. porovnání a < b < c piš jako a < b && b < c.',
      });
    };
    const parseNeg = (op1) => {
      const it = items[pos];
      if (it.neg) {
        const negOp = { prec: 6, assoc: 'l', neg: true, tok: it.tok, op: { name: '-', line: it.tok.line, col: it.tok.col } };
        if (op1.prec >= 6) precErr(op1, negOp);
        pos++;
        const r = parseNeg(negOp);
        const ne = { t: 'neg', e: r, opStart: it.tok.start, opEnd: it.tok.end, start: it.tok.start, end: r.end, line: it.tok.line, col: it.tok.col };
        return parse1(op1, ne);
      }
      pos++;
      return parse1(op1, it);
    };
    const parse1 = (op1, e1) => {
      for (;;) {
        if (pos >= items.length) return e1;
        const op2 = opInfo(items[pos]);
        if (op1.prec === op2.prec && (op1.assoc !== op2.assoc || op1.assoc === 'n') && !op1.start) precErr(op1, op2);
        if (op1.prec > op2.prec || (op1.prec === op2.prec && op1.assoc === 'l')) return e1;
        pos++;
        const r = parseNeg(op2);
        e1 = { t: 'binop', op: op2.op, l: e1, r, start: e1.start, end: r.end, line: e1.line, col: e1.col };
      }
    };
    return parseNeg({ prec: -1, assoc: 'n', start: true });
  }

  parseExp10() {
    const t = this.peek();
    if (t.type === 'op' && t.text === '\\' && !this.stopped(t)) {
      this.next();
      const pats = [];
      while (!this.is('->')) {
        if (!this.startsAPat()) this.fail(this.peek(), 'Lambda vypadá takto: \\x -> x + 1');
        pats.push(this.parseAPat());
      }
      if (!pats.length) this.fail(this.peek());
      this.next();
      const body = this.parseExp();
      return this.mk('lam', { pats, body }, t);
    }
    if (t.type === 'kw' && !this.stopped(t)) {
      if (t.text === 'let') {
        this.next();
        const decls = groupClauses(this.block(() => this.parseDecl(false)));
        if (!(this.peek().type === 'kw' && this.peek().text === 'in')) {
          this.fail(this.peek(), 'Výraz let … musí pokračovat slovem in (v konzoli lze napsat i samotné let x = …).');
        }
        this.next();
        const body = this.parseExp();
        return this.mk('let', { decls, body }, t);
      }
      if (t.text === 'if') {
        this.next();
        const c = this.parseExp();
        if (this.is(';')) this.next();
        if (!(this.peek().type === 'kw' && this.peek().text === 'then' && !this.stopped())) {
          const u = this.peek();
          this.fail(u, u.text === '=' ? 'Porovnání se v Haskellu píše ==, jedno = je jen pro definici.' : 'Za podmínkou if musí následovat then.');
        }
        this.next();
        const th = this.parseExp();
        if (this.is(';')) this.next();
        if (!(this.peek().type === 'kw' && this.peek().text === 'else' && !this.stopped())) {
          this.fail(this.peek(), 'V Haskellu musí mít if vždy i větev else.');
        }
        this.next();
        const el = this.parseExp();
        return this.mk('if', { c, th, el }, t);
      }
      if (t.text === 'case') {
        this.next();
        const scrut = this.parseExp();
        if (!(this.peek().type === 'kw' && this.peek().text === 'of' && !this.stopped())) this.fail(this.peek(), 'case … musí pokračovat slovem of.');
        this.next();
        const alts = this.block(() => this.parseAlt());
        return this.mk('case', { scrut, alts }, t);
      }
      if (t.text === 'do') throw new HsError('parse', 'do-notation is not supported', { line: t.line, col: t.col, hint: 'Blok do (IO) tenhle trenažér nepodporuje.' });
    }
    return this.parseFExp();
  }

  parseAlt() {
    const s = this.peek();
    const pat = this.parsePat();
    const rhs = this.parseRhs('->');
    const where = this.parseWhere();
    return { pat, rhs, where, line: s.line, col: s.col };
  }

  startsAExp(t = this.peek()) {
    if (this.stopped(t)) return false;
    return t.type === 'id' || t.type === 'con' || t.type === 'num' || t.type === 'char' || t.type === 'str' ||
      (t.type === 'punct' && (t.text === '(' || t.text === '['));
  }

  parseFExp() {
    let f = this.parseAExp();
    while (this.startsAExp()) {
      const a = this.parseAExp();
      f = { t: 'app', f, a, start: f.start, end: a.end, line: f.line, col: f.col };
    }
    return f;
  }

  parseAExp() {
    const t = this.peek();
    if (this.stopped(t)) this.fail(t);
    switch (t.type) {
      case 'id': this.next(); return this.mk('var', { name: t.text }, t);
      case 'con': this.next(); return this.mk('con', { name: t.text }, t);
      case 'num': case 'char': case 'str': this.next(); return this.mk('lit', { lit: litOf(t), text: t.text }, t);
      case 'punct':
        if (t.text === '(') return this.parseParen();
        if (t.text === '[') return this.parseBracket();
        break;
      case 'err':
        throw new HsError('parse', t.text.startsWith('"') ? 'lexical error in string/character literal at end of input' : `lexical error at character ‘${t.text}’`, {
          line: t.line, col: t.col,
          hint: t.text.startsWith('"') ? 'Neukončený řetězec. Chybí uzavírací uvozovka ".' : t.text === "'" ? 'Znak se píše v apostrofech, např. \'a\' (jen jeden znak); text patří do uvozovek "abc".' : 'Neznámý znak.',
        });
      default: break;
    }
    this.fail(t);
  }

  parseParen() {
    const s = this.next(); // (
    if (this.is(')')) { this.next(); return this.mk('con', { name: '()' }, s); }
    if (this.is(',')) {
      let n = 1;
      while (this.is(',')) { this.next(); n++; }
      this.expect(')');
      return this.mk('var', { name: '(' + ','.repeat(n - 1) + ')', tupleCon: n }, s);
    }
    const t = this.peek();
    // (op)
    if (t.type === 'op' && !RESERVED_OPS.has(t.text) && this.peek(1).text === ')' && !this.stopped(this.peek(1))) {
      this.next(); this.next();
      return this.mk('var', { name: t.text, opvar: true, opStart: t.start, opEnd: t.end }, s);
    }
    if (t.text === '`' && this.peek(2).text === '`' && this.peek(3).text === ')') {
      this.next(); const n = this.next(); this.next(); this.next();
      return this.mk('var', { name: n.text, opvar: true, backtick: true, opStart: t.start, opEnd: n.end + 1 }, s);
    }
    // pravá sekce (op e), kromě minus
    if ((t.type === 'op' && !RESERVED_OPS.has(t.text) && t.text !== '-') || t.text === '`') {
      const op = this.parseOpTok();
      const e = this.parseInfix(false).e;
      this.expect(')');
      return this.mk('sectionR', { op, e }, s);
    }
    const { e, trailing } = this.parseInfix(true);
    if (trailing) {
      this.expect(')');
      return this.mk('sectionL', { op: trailing, e }, s);
    }
    let inner = e;
    if (this.is('::')) {
      this.next();
      const sig = this.parseSigType();
      inner = { t: 'ann', e, sig, start: e.start, end: this.lastEnd, line: e.line, col: e.col };
    }
    if (this.is(',')) {
      const items = [inner];
      while (this.is(',')) { this.next(); items.push(this.parseExp()); }
      this.expect(')');
      return this.mk('tuple', { items }, s);
    }
    this.expect(')');
    return this.mk('paren', { e: inner }, s);
  }

  parseBracket() {
    const s = this.next(); // [
    if (this.is(']')) { this.next(); return this.mk('list', { items: [] }, s); }
    const e1 = this.parseExp();
    if (this.is('..')) {
      this.next();
      if (this.is(']')) { this.next(); return this.mk('range', { from: e1, then: null, to: null }, s); }
      const e3 = this.parseExp();
      this.expect(']');
      return this.mk('range', { from: e1, then: null, to: e3 }, s);
    }
    if (this.is('|')) {
      this.next();
      const quals = [this.parseQual()];
      while (this.is(',')) { this.next(); quals.push(this.parseQual()); }
      this.expect(']');
      return this.mk('comp', { e: e1, quals }, s);
    }
    if (this.is(',')) {
      this.next();
      const e2 = this.parseExp();
      if (this.is('..')) {
        this.next();
        if (this.is(']')) { this.next(); return this.mk('range', { from: e1, then: e2, to: null }, s); }
        const e3 = this.parseExp();
        this.expect(']');
        return this.mk('range', { from: e1, then: e2, to: e3 }, s);
      }
      const items = [e1, e2];
      while (this.is(',')) { this.next(); items.push(this.parseExp()); }
      this.expect(']');
      return this.mk('list', { items }, s);
    }
    this.expect(']');
    return this.mk('list', { items: [e1] }, s);
  }

  parseQual() {
    const s = this.peek();
    if (s.type === 'kw' && s.text === 'let' && !this.stopped(s)) {
      // let v generátoru (bez in)
      const save = this.i, saveEnd = this.lastEnd;
      this.next();
      const decls = groupClauses(this.block(() => this.parseDecl(false)));
      if (this.peek().type === 'kw' && this.peek().text === 'in') {
        this.i = save; this.lastEnd = saveEnd;
      } else {
        return { t: 'qlet', decls, line: s.line, col: s.col };
      }
    }
    const save = this.i, saveEnd = this.lastEnd;
    try {
      const p = this.parsePat();
      if (this.is('<-')) {
        this.next();
        const e = this.parseExp();
        return { t: 'qgen', pat: p, e, line: s.line, col: s.col };
      }
    } catch (err) {
      if (!(err instanceof HsError)) throw err;
    }
    this.i = save; this.lastEnd = saveEnd;
    const e = this.parseExp();
    return { t: 'qguard', e, line: s.line, col: s.col };
  }
}

function typeToContext(t, s) {
  const one = (c) => {
    if (c.t === 'tapp' && c.f.t === 'tcon' && c.args.length === 1 && c.args[0].t === 'tvar') return { cls: c.f.name, v: c.args[0].name, line: c.f.line, col: c.f.col };
    throw new HsError('parse', 'Malformed head of type or class declaration', { line: s.line, col: s.col, hint: 'Kontext se píše např. (Num a, Ord a) => a -> a' });
  };
  if (t.t === 'ttuple') return t.items.map(one);
  if (t.t === 'tcon' && t.name === '()') return [];
  return [one(t)];
}

function litOf(t) {
  if (t.type === 'num') {
    const s = t.text;
    if (/^0[xX]/.test(s)) return { kind: 'int', value: BigInt(s) };
    if (/^0[oO]/.test(s)) return { kind: 'int', value: BigInt('0o' + s.slice(2)) };
    if (/[.eE]/.test(s)) return { kind: 'float', value: Number(s) };
    return { kind: 'int', value: BigInt(s) };
  }
  if (t.type === 'char') return { kind: 'char', value: decodeEscapes(t.text.slice(1, -1))[0] };
  return { kind: 'string', value: decodeEscapes(t.text.slice(1, -1)) };
}

function negLit(l) {
  return { kind: l.kind, value: -l.value };
}

function patText(src, p) { return src.slice(p.start, p.end); }

// Sloučí sousední klauzule stejné funkce, ohlídá rozdělené definice.
export function groupClauses(decls) {
  const out = [];
  const seen = new Map();
  for (const d of decls) {
    if (d.t === 'fun') {
      const prev = out[out.length - 1];
      if (prev && prev.t === 'fun' && prev.name === d.name) {
        prev.clauses.push(...d.clauses);
        prev.end = d.end;
        continue;
      }
      if (seen.has(d.name)) {
        const first = seen.get(d.name);
        throw new HsError('scope', `Multiple declarations of ‘${d.name}’`, {
          line: d.line, col: d.col,
          hint: `Funkce ${d.name} už je definovaná na řádku ${first.line}. Všechny řádky (klauzule) jedné funkce musí být hned pod sebou.`,
        });
      }
      seen.set(d.name, d);
    }
    out.push(d);
  }
  return out;
}

function hintForToken(t) {
  switch (t.text) {
    case '=': return 'Samotné = slouží jen k definici. Porovnání se píše ==.';
    case '=>': return 'Větší nebo rovno se v Haskellu píše >=.';
    case 'then': return 'Před then chybí podmínka, nebo je výraz před ním neúplný.';
    case 'else': return 'else bez if…then, nebo chybí výraz za then.';
    case ')': return 'Nesedí závorky. Je tu ) navíc, nebo chybí výraz uvnitř.';
    case ']': return 'Nesedí hranaté závorky nebo chybí prvek seznamu.';
    case '|': return 'Svislítko | začíná stráž. Musí být na novém řádku odsazené víc než název funkce, za podmínkou následuje =.';
    case 'where': return 'where musí být odsazené víc než začátek definice funkce.';
    case '->': return 'Šipka -> patří do lambdy (\\x -> …) nebo case; v definici funkce se píše =.';
    case '<-': return 'Šipka <- patří jen do generátoru seznamu [x | x <- xs].';
    case ',': return 'Čárka mimo seznam/n-tici. Nechybí hranaté nebo kulaté závorky?';
    case 'in': return 'in bez let, nebo neúplná definice v let.';
    default: return '';
  }
}

function hintForStop(t) {
  if (t && t.type !== 'eof') {
    if (t.text === '|') return 'Stráže (řádky začínající |) musí být odsazené víc než název funkce, např. o 4 mezery.';
    if (t.text === 'where') return 'where musí být odsazené víc než začátek definice funkce.';
    if (t.text === 'then' || t.text === 'else') return `${t.text} na novém řádku musí být odsazené víc než začátek definice funkce.`;
    if (t.type === 'op' || t.text === '=') return 'Pokračování výrazu na dalším řádku musí být odsazené víc než název funkce.';
  }
  return 'Výraz je neúplný nebo špatně odsazený. Zkontroluj závorky a odsazení (pokračování řádku i stráže musí být odsazené víc než název funkce).';
}

export function parseModuleSrc(src, fixities) {
  return new Parser(src, { fixities }).parseModule();
}

export function parseExprSrc(src, fixities) {
  return new Parser(src, { fixities }).parseExprOnly();
}
