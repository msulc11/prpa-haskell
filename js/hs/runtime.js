// Běhové hodnoty: celá čísla = BigInt, Double = number, Char = JS řetězec (1 code point),
// Bool = true/false, () = UNIT, seznam = NIL / Cons, n-tice = Tup, funkce = Fn, odložené výpočty = Thunk.
//
// Vyhodnocování běží na stroji s explicitním zásobníkem: kód jsou generátory, které
// „yieldují“ požadavky (Thunk = vynuť, Call = zavolej funkci). Hloubka rekurze v Haskellu
// tak není omezená zásobníkem JS.

import { HsError } from './errors.js';
import { prune } from './types.js';

export const state = { steps: 0, fuel: Infinity, maxStack: 100000 };

export class Thunk {
  constructor(code, env, g) { this.code = code; this.env = env; this.g = g; this.v = undefined; this.s = 0; }
}
export class Cons {
  constructor(h, t) { this.h = h; this.t = t; }
}
export class Tup {
  constructor(xs) { this.xs = xs; }
}
class Unit {}
class Nil {}
export const UNIT = new Unit();
export const NIL = new Nil();
const EMPTY = [];
export class Fn {
  // impl(args) -> generátor vracející WHNF (nebo TailCall)
  constructor(arity, impl, args, name) { this.arity = arity; this.impl = impl; this.args = args || EMPTY; this.name = name; }
}
export class TailCall {
  constructor(f, args) { this.f = f; this.args = args; }
}
export class Call {
  constructor(f, args) { this.f = f; this.args = args; }
}
class UpdF { constructor(t) { this.t = t; } }
class AppF { constructor(args) { this.args = args; } }

export const delayG = (gen, env) => new Thunk(gen, env, true);
export const lazy = (fn) => new Thunk(fn, null, false);     // čistá JS funkce, nic nevynucuje
export const lazyG = (gen) => new Thunk(gen, null, true);   // generátor

export function rtError(msg, hint) {
  return new HsError('runtime', '*** Exception: ' + msg, { hint: hint || '' });
}
export function timeoutError() {
  return new HsError('timeout', 'Výpočet trvá příliš dlouho (překročen limit kroků).', {
    hint: 'Možná nekonečná rekurze (chybí koncová podmínka, nebo se argument nezmenšuje), nebo se počítá s nekonečným seznamem.',
  });
}
export function stackError() {
  return new HsError('stack', 'stack overflow', {
    hint: 'Rekurze je moc hluboká nebo se nezastaví. Chybí koncová podmínka (např. f 0 = … nebo f [] = …), nebo se argument v rekurzivním volání nezmenšuje?',
  });
}
function loopError() { return rtError('<<loop>>', 'Hodnota závisí sama na sobě. Nekonečná smyčka.'); }

// vynucení uvnitř generátoru: x = yield* W(x)
export function* W(x) {
  if (x instanceof Thunk) return x.s === 2 ? x.v : yield x;
  return x;
}

// ---------- stroj ----------
export function run(gen) {
  const stack = [gen];
  let input;
  let err = null;

  const startForce = (t) => {
    if (t.s === 2) { input = t.v; return; }
    if (t.s === 1) { err = loopError(); return; }
    if (stack.length > state.maxStack) { err = stackError(); return; }
    t.s = 1;
    if (t.g) {
      stack.push(new UpdF(t));
      stack.push(t.code(t.env));
      input = undefined;
    } else {
      try {
        const v = t.code(t.env);
        t.v = v; t.s = 2; t.code = null; t.env = null;
        input = v;
      } catch (e) { t.s = 0; err = e; }
    }
  };

  const startApply = (f, args) => {
    for (;;) {
      if (f instanceof Thunk) {
        if (f.s === 2) f = f.v;
        else { stack.push(new AppF(args)); startForce(f); return; }
      }
      const have = f.args.length;
      const need = f.arity - have;
      if (args.length < need) { input = new Fn(f.arity, f.impl, have ? f.args.concat(args) : args.slice(), f.name); return; }
      let callArgs;
      if (args.length === need) callArgs = have ? f.args.concat(args) : args;
      else {
        callArgs = have ? f.args.concat(args.slice(0, need)) : args.slice(0, need);
        stack.push(new AppF(args.slice(need)));
      }
      if (stack.length > state.maxStack) { err = stackError(); return; }
      if (f.arity === 0) { input = f; return; }
      stack.push(f.impl(callArgs));
      input = undefined;
      return;
    }
  };

  for (;;) {
    const n = stack.length;
    if (n === 0) {
      if (err) throw err;
      return input;
    }
    const top = stack[n - 1];
    if (top instanceof UpdF) {
      stack.pop();
      const t = top.t;
      if (err) { if (t.s === 1) t.s = 0; continue; }
      t.v = input; t.s = 2; t.code = null; t.env = null;
      continue;
    }
    if (top instanceof AppF) {
      stack.pop();
      if (err) continue;
      startApply(input, top.args);
      continue;
    }
    let r;
    try {
      if (++state.steps > state.fuel) throw timeoutError();
      r = err ? top.throw(err) : top.next(input);
      err = null;
    } catch (e) {
      stack.pop();
      err = e;
      input = undefined;
      continue;
    }
    if (r.done) {
      stack.pop();
      const v = r.value;
      if (v instanceof TailCall) startApply(v.f, v.args);
      else input = v;
      continue;
    }
    const req = r.value;
    if (req instanceof Thunk) startForce(req);
    else if (req instanceof Call) startApply(req.f, req.args);
    else { err = new Error('stroj: neznámý požadavek'); }
  }
}

// vyhodnoť hodnotu/thunk do WHNF mimo generátor (spustí stroj)
export function forceTop(x) {
  if (x instanceof Thunk) {
    if (x.s === 2) return x.v;
    return run(W(x));
  }
  return x;
}

// ---------- seznamy ----------
export function fromArray(arr) {
  let l = NIL;
  for (let i = arr.length - 1; i >= 0; i--) l = new Cons(arr[i], l);
  return l;
}
export function fromStr(s) { return fromArray(Array.from(s)); }
export function* toStrG(v) {
  let out = '';
  let x = yield* W(v);
  while (x instanceof Cons) {
    out += yield* W(x.h);
    x = yield* W(x.t);
    if (out.length > 100000) break;
  }
  return out;
}

// ---------- čísla ----------
const isBig = (x) => typeof x === 'bigint';
export const toNum = (x) => (isBig(x) ? Number(x) : x);
export function toBig(x) {
  if (isBig(x)) return x;
  if (!Number.isFinite(x)) throw rtError('Prelude: conversion of non-finite Double to integer');
  return BigInt(Math.trunc(x));
}
export const numAdd = (a, b) => (isBig(a) && isBig(b) ? a + b : toNum(a) + toNum(b));
export const numSub = (a, b) => (isBig(a) && isBig(b) ? a - b : toNum(a) - toNum(b));
export const numMul = (a, b) => (isBig(a) && isBig(b) ? a * b : toNum(a) * toNum(b));
export const numNeg = (a) => -a;
export const numAbs = (a) => (isBig(a) ? (a < 0n ? -a : a) : Math.abs(a));
export const numSignum = (a) => (isBig(a) ? (a > 0n ? 1n : a < 0n ? -1n : 0n) : (a > 0 ? 1 : a < 0 ? -1 : a));
export const numDivide = (a, b) => toNum(a) / toNum(b);

function divZero() { return rtError('divide by zero', 'Dělení nulou. Zkontroluj koncovou podmínku nebo dělitele.'); }
export function intDiv(a, b) {
  a = toBig(a); b = toBig(b);
  if (b === 0n) throw divZero();
  let q = a / b;
  if ((a % b !== 0n) && ((a < 0n) !== (b < 0n))) q -= 1n;
  return q;
}
export function intMod(a, b) {
  a = toBig(a); b = toBig(b);
  if (b === 0n) throw divZero();
  let r = a % b;
  if (r !== 0n && ((r < 0n) !== (b < 0n))) r += b;
  return r;
}
export function intQuot(a, b) {
  a = toBig(a); b = toBig(b);
  if (b === 0n) throw divZero();
  return a / b;
}
export function intRem(a, b) {
  a = toBig(a); b = toBig(b);
  if (b === 0n) throw divZero();
  return a % b;
}
export function numPow(a, b) {
  b = toBig(b);
  if (b < 0n) throw rtError('Negative exponent', 'Operátor ^ potřebuje nezáporný celočíselný exponent; pro záporný použij ^^ nebo **.');
  if (isBig(a)) {
    if (b > 100000n && a !== 0n && a !== 1n && a !== -1n) throw rtError('exponent is too large for this trainer');
    return a ** b;
  }
  return Math.pow(a, Number(b));
}
export function roundHalfEven(x) {
  if (isBig(x)) return x;
  const f = Math.floor(x);
  const d = x - f;
  let r;
  if (d < 0.5) r = f;
  else if (d > 0.5) r = f + 1;
  else r = (f % 2 === 0) ? f : f + 1;
  return toBig(r);
}

// porovnání už vyhodnocených skalárů
export function cmpPlain(a, b) {
  const ta = typeof a;
  if (ta === 'bigint' || ta === 'number') return a < b ? -1 : a > b ? 1 : (a == b ? 0 : 1); // eslint-disable-line eqeqeq
  if (ta === 'string') { const x = a.codePointAt(0), y = b.codePointAt(0); return x < y ? -1 : x > y ? 1 : 0; }
  if (ta === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  return 0;
}

// ---------- rovnost, porovnání (generátory) ----------
export function* hsEqG(a, b) {
  for (;;) {
    a = yield* W(a); b = yield* W(b);
    const ta = typeof a;
    if (ta === 'bigint' || ta === 'number') return a == b; // eslint-disable-line eqeqeq
    if (ta === 'string' || ta === 'boolean') return a === b;
    if (a === UNIT) return true;
    if (a === NIL || b === NIL) return a === b;
    if (a instanceof Cons) {
      if (!(b instanceof Cons)) return false;
      if (!(yield* hsEqG(a.h, b.h))) return false;
      a = a.t; b = b.t;
      continue;
    }
    if (a instanceof Tup) {
      for (let i = 0; i < a.xs.length; i++) if (!(yield* hsEqG(a.xs[i], b.xs[i]))) return false;
      return true;
    }
    throw new Error('hsEq: nepodporovaná hodnota');
  }
}

export function* hsCmpG(a, b) {
  for (;;) {
    a = yield* W(a); b = yield* W(b);
    const ta = typeof a;
    if (ta === 'bigint' || ta === 'number' || ta === 'string' || ta === 'boolean') return cmpPlain(a, b);
    if (a === UNIT) return 0;
    if (a === NIL) return b === NIL ? 0 : -1;
    if (a instanceof Cons) {
      if (b === NIL) return 1;
      const c = yield* hsCmpG(a.h, b.h);
      if (c !== 0) return c;
      a = a.t; b = b.t;
      continue;
    }
    if (a instanceof Tup) {
      for (let i = 0; i < a.xs.length; i++) { const c = yield* hsCmpG(a.xs[i], b.xs[i]); if (c !== 0) return c; }
      return 0;
    }
    throw new Error('hsCompare: nepodporovaná hodnota');
  }
}

// ---------- Enum ----------
function genBig(n, step, stop) {
  const go = (k) => {
    if (stop !== null && (step >= 0n ? k > stop : k < stop)) return NIL;
    return new Cons(k, lazy(() => go(k + step)));
  };
  return go(n);
}
function genNum(x0, step, limit) {
  const go = (k) => {
    const x = x0 + k * step;
    if (limit !== null && (step >= 0 ? x > limit : x < limit)) return NIL;
    return new Cons(x, lazy(() => go(k + 1)));
  };
  return go(0);
}
function genChar(c, step, stop) {
  const go = (k) => {
    if (k < 0 || k > 0x10ffff || (stop !== null && (step >= 0 ? k > stop : k < stop))) return NIL;
    return new Cons(String.fromCodePoint(k), lazy(() => go(k + step)));
  };
  return go(c);
}
const cp = (c) => c.codePointAt(0);

// argumenty už ve WHNF
export function enumFrom(a) {
  if (isBig(a)) return genBig(a, 1n, null);
  if (typeof a === 'number') return genNum(a, 1, null);
  if (typeof a === 'string') return genChar(cp(a), 1, 0x10ffff);
  if (typeof a === 'boolean') return a ? fromArray([true]) : fromArray([false, true]);
  return fromArray([UNIT]);
}
export function enumFromTo(a, b) {
  if (isBig(a) && isBig(b)) return genBig(a, 1n, b);
  if (typeof a === 'string') return genChar(cp(a), 1, cp(b));
  if (typeof a === 'boolean') { const xs = []; for (let i = a ? 1 : 0; i <= (b ? 1 : 0); i++) xs.push(i === 1); return fromArray(xs); }
  if (a === UNIT) return fromArray([UNIT]);
  return genNum(toNum(a), 1, toNum(b) + 0.5);
}
export function enumFromThen(a, a2) {
  if (isBig(a) && isBig(a2)) return genBig(a, a2 - a, null);
  if (typeof a === 'string') { const s = cp(a2) - cp(a); return genChar(cp(a), s, s >= 0 ? 0x10ffff : 0); }
  if (typeof a === 'boolean') return enumFromThenTo(a, a2, a2 >= a);
  return genNum(toNum(a), toNum(a2) - toNum(a), null);
}
export function enumFromThenTo(a, a2, b) {
  if (isBig(a) && isBig(a2) && isBig(b)) return genBig(a, a2 - a, b);
  if (typeof a === 'string') return genChar(cp(a), cp(a2) - cp(a), cp(b));
  if (typeof a === 'boolean') {
    const s = (a2 ? 1 : 0) - (a ? 1 : 0), xs = [];
    for (let i = a ? 1 : 0; s >= 0 ? i <= (b ? 1 : 0) : i >= (b ? 1 : 0); i += s) { xs.push(i === 1); if (s === 0 || xs.length > 2) break; }
    return fromArray(xs);
  }
  const x = toNum(a), step = toNum(a2) - x;
  return genNum(x, step, toNum(b) + step / 2);
}

// ---------- show ----------
export class Out {
  constructor(max) { this.parts = []; this.len = 0; this.max = max; }
  push(s) {
    if (this.len + s.length > this.max) {
      this.parts.push(s.slice(0, this.max - this.len));
      this.len = this.max;
      throw TRUNC;
    }
    this.parts.push(s); this.len += s.length;
  }
  toString() { return this.parts.join(''); }
}
export const TRUNC = { truncated: true };

export function showDouble(x) {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const neg = x < 0;
  const m = Math.abs(x).toExponential().match(/^(\d)(?:\.(\d+))?e([+-]\d+)$/);
  const digits = m[1] + (m[2] || '');
  const e = parseInt(m[3], 10) + 1; // x = 0.d1d2... * 10^e
  let s;
  if (e >= 0 && e <= 7) {
    if (e === 0) s = '0.' + digits;
    else {
      const ip = digits.length >= e ? digits.slice(0, e) : digits + '0'.repeat(e - digits.length);
      const fp = digits.length > e ? digits.slice(e) : '0';
      s = ip + '.' + fp;
    }
  } else {
    s = digits[0] + '.' + (digits.length > 1 ? digits.slice(1) : '0') + 'e' + (e - 1);
  }
  return (neg ? '-' : '') + s;
}

const ASCII_TAB = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US', 'SP'];
const SIMPLE = { 7: '\\a', 8: '\\b', 12: '\\f', 10: '\\n', 13: '\\r', 9: '\\t', 11: '\\v' };

function litChar(c) {
  const n = c.codePointAt(0);
  if (n > 127) return ['\\' + n, 'digit'];
  if (n === 127) return ['\\DEL', null];
  if (c === '\\') return ['\\\\', null];
  if (n >= 32) return [c, null];
  if (SIMPLE[n]) return [SIMPLE[n], null];
  if (n === 14) return ['\\SO', 'H'];
  return ['\\' + ASCII_TAB[n], null];
}

export function showCharLit(c) {
  if (c === "'") return "'\\''";
  return "'" + litChar(c)[0] + "'";
}

function* showStringG(v, out) {
  out.push('"');
  let x = yield* W(v);
  let protect = null;
  while (x instanceof Cons) {
    const c = yield* W(x.h);
    if (protect === 'digit' && c >= '0' && c <= '9') out.push('\\&');
    if (protect === 'H' && c === 'H') out.push('\\&');
    if (c === '"') { out.push('\\"'); protect = null; }
    else { const [s, p] = litChar(c); out.push(s); protect = p; }
    x = yield* W(x.t);
  }
  out.push('"');
}

// show podle běhové reprezentace (funkce show uvnitř programu)
export function* showRuntimeG(v, out) {
  const x = yield* W(v);
  if (isBig(x)) return out.push(x.toString());
  if (typeof x === 'number') return out.push(showDouble(x));
  if (typeof x === 'string') return out.push(showCharLit(x));
  if (typeof x === 'boolean') return out.push(x ? 'True' : 'False');
  if (x === UNIT) return out.push('()');
  if (x === NIL) return out.push('[]');
  if (x instanceof Cons) {
    if (typeof (yield* W(x.h)) === 'string') return yield* showStringG(x, out);
    out.push('[');
    let l = x, first = true;
    while (l instanceof Cons) {
      if (!first) out.push(',');
      first = false;
      yield* showRuntimeG(l.h, out);
      l = yield* W(l.t);
    }
    return out.push(']');
  }
  if (x instanceof Tup) {
    out.push('(');
    for (let i = 0; i < x.xs.length; i++) { if (i) out.push(','); yield* showRuntimeG(x.xs[i], out); }
    return out.push(')');
  }
  if (x instanceof Fn) return out.push('<function>');
  return out.push(String(x));
}

// show řízený typem (výstup konzole)
export function* showTypedG(v, t, out) {
  t = prune(t);
  if (t.k !== 'con') return yield* showRuntimeG(v, out);
  switch (t.name) {
    case 'Int': case 'Integer': { const x = yield* W(v); return out.push(isBig(x) ? x.toString() : toBig(x).toString()); }
    case 'Double': return out.push(showDouble(toNum(yield* W(v))));
    case 'Bool': return out.push((yield* W(v)) ? 'True' : 'False');
    case 'Char': return out.push(showCharLit(yield* W(v)));
    case '()': yield* W(v); return out.push('()');
    case '[]': {
      const el = prune(t.args[0]);
      if (el.k === 'con' && el.name === 'Char') return yield* showStringG(v, out);
      out.push('[');
      let l = yield* W(v), first = true;
      while (l instanceof Cons) {
        if (!first) out.push(',');
        first = false;
        yield* showTypedG(l.h, el, out);
        l = yield* W(l.t);
      }
      return out.push(']');
    }
    default:
      if (t.name.startsWith('(,')) {
        const x = yield* W(v);
        out.push('(');
        for (let i = 0; i < t.args.length; i++) { if (i) out.push(','); yield* showTypedG(x.xs[i], t.args[i], out); }
        return out.push(')');
      }
      return yield* showRuntimeG(v, out);
  }
}
