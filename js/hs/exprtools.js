// Pomocníci pro úlohu 1: strom výrazu, plné uzávorkování, krokování výpočtu, porovnání struktury.

import { Parser, DEFAULT_FIXITY } from './parser.js';
import { Scoper } from './scope.js';
import { TC, prune } from './types.js';
import { HsError, toPlain } from './errors.js';
import {
  numAdd, numSub, numMul, numNeg, numAbs, numSignum, numDivide, intDiv, intMod, intQuot, intRem, numPow,
  cmpPlain, toNum, toBig, roundHalfEven, showDouble, showCharLit,
} from './runtime.js';

function parse(src) { return new Parser(src).parseExprOnly(); }
function strip(e) { while (e.t === 'paren') e = e.e; return e; }

function flattenApp(e) {
  let f = e; const args = [];
  while (f.t === 'app') { args.unshift(f.a); f = f.f; }
  return { f, args };
}

// ---------- exprTree ----------
function toTree(e, src) {
  e = strip(e);
  switch (e.t) {
    case 'binop':
      return { kind: 'op', op: e.op.name, opStart: e.op.start, opEnd: e.op.end, left: toTree(e.l, src), right: toTree(e.r, src), start: e.start, end: e.end };
    case 'app': {
      const { f, args } = flattenApp(e);
      return { kind: 'app', fn: toTree(f, src), args: args.map((a) => toTree(a, src)), headStart: f.start, headEnd: f.end, start: e.start, end: e.end };
    }
    case 'neg': return { kind: 'neg', arg: toTree(e.e, src), opStart: e.opStart, opEnd: e.opEnd, start: e.start, end: e.end };
    case 'sectionL': return { kind: 'section', op: e.op.name, side: 'left', arg: toTree(e.e, src), start: e.start, end: e.end };
    case 'sectionR': return { kind: 'section', op: e.op.name, side: 'right', arg: toTree(e.e, src), start: e.start, end: e.end };
    case 'var':
      if (e.opvar) return { kind: 'opfn', op: e.name, start: e.start, end: e.end };
      return { kind: 'var', name: e.name, start: e.start, end: e.end };
    case 'lit': return { kind: 'lit', text: src.slice(e.start, e.end), start: e.start, end: e.end };
    case 'con': return { kind: 'lit', text: e.name, start: e.start, end: e.end };
    default: return { kind: 'other', start: e.start, end: e.end };
  }
}

export function exprTree(src) {
  try {
    return { ok: true, tree: toTree(parse(src), src) };
  } catch (e) {
    return { ok: false, error: toPlain(e, 'expr') };
  }
}

// ---------- parenthesize ----------
const opText = (op) => (op.backtick ? '`' + op.name + '`' : op.name);
const isAtomicAst = (e) => {
  e = strip(e);
  return e.t === 'var' || e.t === 'lit' || e.t === 'con' || e.t === 'sectionL' || e.t === 'sectionR' ||
    e.t === 'list' || e.t === 'tuple' || e.t === 'range' || e.t === 'comp';
};

function full(e, src) {
  e = strip(e);
  const wrap = (x) => (isAtomicAst(x) ? full(x, src) : `(${full(x, src)})`);
  switch (e.t) {
    case 'binop': return `${wrap(e.l)} ${opText(e.op)} ${wrap(e.r)}`;
    case 'app': {
      const { f, args } = flattenApp(e);
      return [wrap(f), ...args.map(wrap)].join(' ');
    }
    case 'neg': return '-' + wrap(e.e);
    case 'sectionL': case 'sectionR':
      return isAtomicAst(e.e) ? src.slice(e.start, e.end) : (e.t === 'sectionL' ? `(${wrap(e.e)} ${opText(e.op)})` : `(${opText(e.op)} ${wrap(e.e)})`);
    case 'var':
      if (e.opvar) return e.backtick ? `(\`${e.name}\`)` : `(${e.name})`;
      return e.name;
    case 'lit': return src.slice(e.start, e.end);
    case 'con': return e.name;
    default: return src.slice(e.start, e.end);
  }
}

export function parenthesize(src) {
  try {
    return full(parse(src), src);
  } catch (e) {
    return null;
  }
}

// ---------- sameStructure ----------
function norm(t, src) {
  switch (t.kind) {
    case 'op': return ['op', t.op, norm(t.left, src), norm(t.right, src)];
    case 'app': return ['app', norm(t.fn, src), t.args.map((a) => norm(a, src))];
    case 'neg': return ['neg', norm(t.arg, src)];
    case 'section': return ['sec', t.op, t.side, norm(t.arg, src)];
    case 'opfn': return ['opfn', t.op];
    case 'var': return ['var', t.name];
    case 'lit': return ['lit', t.text];
    default: return ['other', src.slice(t.start, t.end).replace(/\s+/g, '')];
  }
}

export function sameStructure(a, b) {
  const ta = exprTree(a), tb = exprTree(b);
  if (!ta.ok || !tb.ok) return false;
  return JSON.stringify(norm(ta.tree, a)) === JSON.stringify(norm(tb.tree, b));
}

// ---------- evalSteps ----------
const FNS = {
  max: [2, (a, b) => (cmpPlain(a, b) >= 0 ? a : b)],
  min: [2, (a, b) => (cmpPlain(a, b) <= 0 ? a : b)],
  div: [2, intDiv], mod: [2, intMod], rem: [2, intRem], quot: [2, intQuot],
  negate: [1, numNeg], abs: [1, numAbs], signum: [1, numSignum],
  not: [1, (a) => !a], even: [1, (a) => intRem(a, 2n) === 0n], odd: [1, (a) => intRem(a, 2n) !== 0n],
  succ: [1, (a) => (typeof a === 'bigint' ? a + 1n : a + 1)], pred: [1, (a) => (typeof a === 'bigint' ? a - 1n : a - 1)],
  subtract: [2, (a, b) => numSub(b, a)],
  sqrt: [1, (a) => Math.sqrt(toNum(a))],
  fromIntegral: [1, (a) => a],
  truncate: [1, (a) => toBig(a)], round: [1, roundHalfEven],
  floor: [1, (a) => (typeof a === 'bigint' ? a : toBig(Math.floor(a)))],
  ceiling: [1, (a) => (typeof a === 'bigint' ? a : toBig(Math.ceil(a)))],
};
const OPS = {
  '+': numAdd, '-': numSub, '*': numMul, '/': numDivide, '^': numPow, '**': (a, b) => Math.pow(toNum(a), toNum(b)),
  '^^': (a, b) => Math.pow(toNum(a), toNum(b)),
  div: intDiv, mod: intMod, rem: intRem, quot: intQuot,
  '==': (a, b) => cmpPlain(a, b) === 0, '/=': (a, b) => cmpPlain(a, b) !== 0,
  '<': (a, b) => cmpPlain(a, b) < 0, '<=': (a, b) => cmpPlain(a, b) <= 0,
  '>': (a, b) => cmpPlain(a, b) > 0, '>=': (a, b) => cmpPlain(a, b) >= 0,
  '&&': (a, b) => a && b, '||': (a, b) => a || b,
  max: FNS.max[1], min: FNS.min[1],
};

class StepUnsupported extends Error {}

function tyKind(t) {
  if (!t) return null;
  t = prune(t);
  if (t.k !== 'con') return null;
  if (t.name === 'Double') return 'double';
  if (t.name === 'Int' || t.name === 'Integer') return 'int';
  if (t.name === 'Bool') return 'bool';
  if (t.name === 'Char') return 'char';
  return null;
}

function coerce(v, kind) {
  if (kind === 'double') return toNum(v);
  if (kind === 'int') return typeof v === 'bigint' ? v : toBig(v);
  return v;
}

// převod AST -> krokovací strom
function stepTree(e) {
  const kind = tyKind(e.ty);
  e = strip(e);
  switch (e.t) {
    case 'lit': {
      const L = e.lit;
      if (L.kind === 'int' || L.kind === 'float') return { k: 'val', v: coerce(L.value, kind || (L.kind === 'float' ? 'double' : 'int')), kind: kind || (L.kind === 'float' ? 'double' : 'int'), text: e.text };
      if (L.kind === 'char') return { k: 'val', v: L.value, kind: 'char' };
      throw new StepUnsupported();
    }
    case 'con':
      if (e.name === 'True' || e.name === 'False') return { k: 'val', v: e.name === 'True', kind: 'bool' };
      throw new StepUnsupported();
    case 'binop':
      if (!OPS[e.op.name] || e.op.ref !== 'prelude') throw new StepUnsupported();
      return { k: 'bin', op: e.op.name, backtick: !!e.op.backtick, l: stepTree(e.l), r: stepTree(e.r), kind };
    case 'neg': {
      const a = stepTree(e.e);
      if (a.k === 'val') return { k: 'val', v: numNeg(a.v), kind: a.kind, text: a.text !== undefined ? '-' + a.text : undefined };
      return { k: 'neg', e: a, kind };
    }
    case 'app': {
      const { f, args } = flattenApp(e);
      const fs = strip(f);
      let fn;
      if (fs.t === 'var' && fs.opvar && OPS[fs.name]) fn = { k: 'opfn', op: fs.name, arity: 2, backtick: !!fs.backtick, impl: OPS[fs.name] };
      else if (fs.t === 'var' && FNS[fs.name] && fs.ref === 'prelude') fn = { k: 'fn', name: fs.name, arity: FNS[fs.name][0], impl: FNS[fs.name][1] };
      else if ((fs.t === 'sectionL' || fs.t === 'sectionR') && OPS[fs.op.name]) {
        fn = { k: 'sec', op: fs.op.name, backtick: !!fs.op.backtick, side: fs.t === 'sectionL' ? 'left' : 'right', arg: stepTree(fs.e), arity: 1, impl: OPS[fs.op.name] };
      } else throw new StepUnsupported();
      if (args.length !== fn.arity) throw new StepUnsupported();
      return { k: 'app', fn, args: args.map(stepTree), kind };
    }
    default: throw new StepUnsupported();
  }
}

const fixOf = (op) => DEFAULT_FIXITY[op] || [9, 'l'];

function showVal(n) {
  if (n.text !== undefined) return n.text;
  switch (n.kind) {
    case 'double': return showDouble(toNum(n.v));
    case 'int': return toBig(n.v).toString();
    case 'bool': return n.v ? 'True' : 'False';
    case 'char': return showCharLit(n.v);
    default: return typeof n.v === 'bigint' ? n.v.toString() : typeof n.v === 'number' ? showDouble(n.v) : String(n.v);
  }
}

function precOf(n) {
  if (n.k === 'val') {
    const s = showVal(n);
    return s.startsWith('-') ? 6 : 11;
  }
  if (n.k === 'bin') return fixOf(n.op)[0];
  if (n.k === 'neg') return 6;
  return 10;
}

function pr(n) {
  switch (n.k) {
    case 'val': return showVal(n);
    case 'neg': {
      const s = pr(n.e);
      return '-' + (precOf(n.e) <= 6 ? `(${s})` : s);
    }
    case 'bin': {
      const [p, a] = fixOf(n.op);
      const pl = precOf(n.l), prr = precOf(n.r);
      let ls = pr(n.l), rs = pr(n.r);
      if (pl < p || (pl === p && a !== 'l')) ls = `(${ls})`;
      if (prr < p || (prr === p && a !== 'r')) rs = `(${rs})`;
      return `${ls} ${n.backtick ? '`' + n.op + '`' : n.op} ${rs}`;
    }
    case 'app': {
      const f = n.fn;
      let fs;
      if (f.k === 'opfn') fs = f.backtick ? `(\`${f.op}\`)` : `(${f.op})`;
      else if (f.k === 'fn') fs = f.name;
      else {
        const as = precOf(f.arg) <= 10 ? `(${pr(f.arg)})` : pr(f.arg);
        const o = f.backtick ? '`' + f.op + '`' : f.op;
        fs = f.side === 'left' ? `(${as} ${o})` : `(${o} ${as})`;
      }
      const args = n.args.map((a) => (precOf(a) <= 10 ? `(${pr(a)})` : pr(a)));
      return [fs, ...args].join(' ');
    }
    default: return '?';
  }
}

function resultKind(n, v) {
  if (n.kind) return n.kind;
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'bigint') return 'int';
  if (typeof v === 'number') return 'double';
  return null;
}

// jeden krok: nejlevější nejvnitřnější redex; vrací nový uzel
function step(n) {
  switch (n.k) {
    case 'val': return null;
    case 'neg': {
      if (n.e.k !== 'val') return { ...n, e: step(n.e) };
      const v = numNeg(n.e.v);
      return { k: 'val', v: coerce(v, n.kind || n.e.kind), kind: n.kind || n.e.kind };
    }
    case 'bin': {
      if (n.l.k !== 'val') return { ...n, l: step(n.l) };
      if (n.r.k !== 'val') return { ...n, r: step(n.r) };
      const v = OPS[n.op](n.l.v, n.r.v);
      const kind = resultKind(n, v);
      return { k: 'val', v: coerce(v, kind), kind };
    }
    case 'app': {
      if (n.fn.k === 'sec' && n.fn.arg.k !== 'val') return { ...n, fn: { ...n.fn, arg: step(n.fn.arg) } };
      for (let i = 0; i < n.args.length; i++) {
        if (n.args[i].k !== 'val') {
          const args = n.args.slice();
          args[i] = step(args[i]);
          return { ...n, args };
        }
      }
      let v;
      if (n.fn.k === 'sec') v = n.fn.side === 'left' ? n.fn.impl(n.fn.arg.v, n.args[0].v) : n.fn.impl(n.args[0].v, n.fn.arg.v);
      else v = n.fn.impl(...n.args.map((a) => a.v));
      const kind = resultKind(n, v);
      return { k: 'val', v: coerce(v, kind), kind };
    }
    default: throw new StepUnsupported();
  }
}

export function evalSteps(src) {
  try {
    const e = parse(src);
    // jen Prelude; typy kvůli Double vs. celé číslo
    const { getPrelude } = PRELUDE_REF;
    const P = getPrelude();
    new Scoper({
      lookupGlobal: (n) => (P.names.has(n) ? 'prelude' : null),
      preludeHas: (n) => P.names.has(n),
      allNames: () => P.names,
    }).expr(e);
    const tc = new TC();
    tc.infer(e, P.tyEnv, 1);
    tc.defaultAmbiguous(0);
    let tree = stepTree(e);
    const steps = [src.trim()];
    let guard = 0;
    while (tree.k !== 'val') {
      tree = step(tree);
      steps.push(pr(tree));
      if (++guard > 80) throw new StepUnsupported();
    }
    for (let i = steps.length - 1; i > 0; i--) if (steps[i] === steps[i - 1] || steps[i].replace(/\s+/g, '') === steps[i - 1].replace(/\s+/g, '')) steps.splice(i, 1);
    return { ok: true, steps, value: showVal(tree) };
  } catch (err) {
    if (err instanceof StepUnsupported) {
      return { ok: false, error: { kind: 'parse', message: 'unsupported expression for stepping', hint: 'Tento výraz krokovat neumím (krokují se jen čísla, logické hodnoty, operátory a pár funkcí jako max, div, mod).', where: 'expr' } };
    }
    return { ok: false, error: toPlain(err, 'expr') };
  }
}

// zpětný odkaz na getPrelude (vyhneme se cyklickému importu při inicializaci)
export const PRELUDE_REF = { getPrelude: null };

export { HsError };
