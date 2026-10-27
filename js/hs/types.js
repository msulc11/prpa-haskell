// Typová kontrola: Hindley–Milner s úrovněmi + lehké typové třídy jako omezení na proměnných.

import { HsError } from './errors.js';
import { patBinders } from './scope.js';

export const GENERIC = Infinity;
let counter = 0;

export class TVar {
  constructor(level) { this.id = ++counter; this.ref = null; this.level = level; this.cls = null; this.hint = null; }
}

export const con = (name, args = []) => ({ k: 'con', name, args });
export const tInt = con('Int');
export const tInteger = con('Integer');
export const tDouble = con('Double');
export const tBool = con('Bool');
export const tChar = con('Char');
export const tUnit = con('()');
export const tList = (t) => con('[]', [t]);
export const tString = () => ({ k: 'con', name: '[]', args: [tChar], syn: 'String' });
export const tFn = (a, b) => con('->', [a, b]);
export const tupleName = (n) => '(' + ','.repeat(n - 1) + ')';
export const tTuple = (ts) => con(tupleName(ts.length), ts);
const isTupleName = (n) => n.startsWith('(,');

export function prune(t) {
  while (t instanceof TVar && t.ref) t = t.ref;
  return t;
}

export function fnChain(args, res) {
  let t = res;
  for (let i = args.length - 1; i >= 0; i--) t = tFn(args[i], t);
  return t;
}

// ---------- třídy ----------
const SUPERS = {
  Eq: [], Ord: ['Eq'], Show: [], Enum: [], Num: [], Real: ['Num', 'Ord'], Integral: ['Real', 'Enum'],
  Fractional: ['Num'], Floating: ['Fractional'], RealFrac: ['Real', 'Fractional'],
};
export const CLASSES = new Set(Object.keys(SUPERS));
const NUMERIC = new Set(['Num', 'Real', 'Integral', 'Fractional', 'Floating', 'RealFrac']);
const closures = {};
export function closure(c) {
  if (closures[c]) return closures[c];
  const s = new Set([c]);
  for (const p of SUPERS[c] || []) for (const x of closure(p)) s.add(x);
  closures[c] = s;
  return s;
}
const INTEGRAL_INST = ['Eq', 'Ord', 'Show', 'Enum', 'Num', 'Real', 'Integral'];
const INST = {
  Int: new Set(INTEGRAL_INST), Integer: new Set(INTEGRAL_INST),
  Double: new Set(['Eq', 'Ord', 'Show', 'Enum', 'Num', 'Real', 'Fractional', 'Floating', 'RealFrac']),
  Bool: new Set(['Eq', 'Ord', 'Show', 'Enum']), Char: new Set(['Eq', 'Ord', 'Show', 'Enum']), '()': new Set(['Eq', 'Ord', 'Show', 'Enum']),
};
const STRUCT_CLS = new Set(['Eq', 'Ord', 'Show']);

function instanceHolds(cls, t) {
  t = prune(t);
  if (t instanceof TVar) return true;
  if (t.k === 'skol') { for (const c of t.cls) if (closure(c).has(cls)) return true; return false; }
  if (t.name === '[]' || isTupleName(t.name)) return STRUCT_CLS.has(cls) && t.args.every((a) => instanceHolds(cls, a));
  const s = INST[t.name];
  return !!(s && s.has(cls));
}

// ---------- tisk typů ----------
function letterName(i) {
  const l = String.fromCharCode(97 + (i % 26));
  return i < 26 ? l : l + Math.floor(i / 26);
}

export function msgNamer() {
  const m = new Map();
  let i = 0;
  return (v) => {
    if (!m.has(v)) m.set(v, letterName(i++) + '0');
    return m.get(v);
  };
}

export function showType(t, namer = msgNamer()) {
  const go = (t, prec) => {
    t = prune(t);
    if (t instanceof TVar) return namer(t);
    if (t.k === 'skol') return t.name;
    if (t.name === '->') {
      const s = go(t.args[0], 1) + ' -> ' + go(t.args[1], 0);
      return prec >= 1 ? `(${s})` : s;
    }
    if (t.name === '[]') {
      const el = prune(t.args[0]);
      if (t.syn === 'String' && el.k === 'con' && el.name === 'Char') return 'String';
      return '[' + go(el, 0) + ']';
    }
    if (isTupleName(t.name)) return '(' + t.args.map((a) => go(a, 0)).join(', ') + ')';
    return t.name;
  };
  return go(t, 0);
}

function showTypeArg(t, namer) {
  const s = showType(t, namer);
  const p = prune(t);
  return (p.k === 'con' && p.name === '->') ? `(${s})` : s;
}

function collectVars(t, out) {
  t = prune(t);
  if (t instanceof TVar) { if (!out.includes(t)) out.push(t); return out; }
  if (t.k === 'con') for (const a of t.args) collectVars(a, out);
  return out;
}

export function showScheme(t) {
  const vars = collectVars(t, []);
  const names = new Map();
  const used = new Set();
  for (const v of vars) {
    if (v.hint && !used.has(v.hint)) { names.set(v, v.hint); used.add(v.hint); }
  }
  let i = 0;
  for (const v of vars) {
    if (names.has(v)) continue;
    let n;
    do { n = letterName(i++); } while (used.has(n));
    names.set(v, n); used.add(n);
  }
  const namer = (v) => names.get(v) || 'a';
  const ctx = [];
  for (const v of vars) {
    if (!v.cls) continue;
    const cs = [...v.cls.keys()];
    for (const c of cs) {
      if (cs.some((d) => d !== c && closure(d).has(c))) continue;
      ctx.push(`${c} ${names.get(v)}`);
    }
  }
  const body = showType(t, namer);
  if (ctx.length === 0) return body;
  if (ctx.length === 1) return `${ctx[0]} => ${body}`;
  return `(${ctx.join(', ')}) => ${body}`;
}

// ---------- typová kontrola ----------
const isList = (t) => { t = prune(t); return t.k === 'con' && t.name === '[]'; };
const isFn = (t) => { t = prune(t); return t.k === 'con' && t.name === '->'; };
const isCon = (t, n) => { t = prune(t); return t.k === 'con' && t.name === n; };

const CTX_HINTS = {
  ifcond: 'Podmínka v if musí být typu Bool (True/False), např. a < b, x == 0 nebo even x.',
  ifbranch: 'Větve then a else musí vracet hodnotu stejného typu (třeba obě číslo, nebo obě seznam).',
  guard: 'Podmínka ve stráži (za |) musí být typu Bool, např. x > 0.',
  guardbody: 'Všechny větve stráží i všechny klauzule funkce musí vracet stejný typ.',
  clause: 'Všechny klauzule (řádky) funkce musí vracet stejný typ.',
  listelem: 'Všechny prvky seznamu musí mít stejný typ.',
  gen: 'Za <- v generátoru musí být seznam.',
  compguard: 'Filtr v generátoru seznamu musí být podmínka typu Bool, např. even x.',
  sig: 'Definice funkce neodpovídá její typové signatuře (řádek s ::).',
  pat: 'Vzor v argumentu neodpovídá typu, se kterým se funkce používá.',
  casealt: 'Všechny alternativy case musí vracet stejný typ.',
  casepat: 'Vzory v case musí odpovídat typu zkoumané hodnoty.',
  ann: 'Výraz nemá typ uvedený za ::.',
};

export class TC {
  // mr: monomorphism restriction (v modulu ano, v konzoli GHCi ne)
  constructor(opts = {}) {
    this.pending = [];
    this.ctx = null;
    this.mr = !!opts.mr;
  }

  // ---------- omezení ----------
  addClass(v, cls, origin) {
    if (!v.cls) v.cls = new Map();
    for (const c of v.cls.keys()) if (closure(c).has(cls)) return;
    v.cls.set(cls, origin);
    this.pending.push(v);
  }

  entail(cls, t, origin) {
    t = prune(t);
    if (t instanceof TVar) { this.addClass(t, cls, origin); return; }
    if (t.k === 'skol') {
      for (const c of t.cls) if (closure(c).has(cls)) return;
      throw this.noInstance(cls, t, origin, true);
    }
    if (t.name === '[]' || isTupleName(t.name)) {
      if (!STRUCT_CLS.has(cls)) throw this.noInstance(cls, t, origin);
      for (const a of t.args) this.entail(cls, a, origin);
      return;
    }
    const s = INST[t.name];
    if (!s || !s.has(cls)) throw this.noInstance(cls, t, origin);
  }

  noInstance(cls, t, origin, rigid) {
    const namer = msgNamer();
    const ts = showTypeArg(t, namer);
    const msg = `No instance for ‘${cls} ${ts}’ arising from ${origin ? origin.text : 'an expression'}`;
    return new HsError('type', msg, {
      line: origin ? origin.line : undefined, col: origin ? origin.col : undefined,
      hint: this.instanceHint(cls, prune(t), rigid, origin),
    });
  }

  instanceHint(cls, t, rigid, origin) {
    const ctx = this.ctx && this.ctx.kind;
    if (rigid) return `V typové signatuře chybí omezení: přidej ${cls} ${t.name} do kontextu, např. (${cls} ${t.name}) => …, nebo použij konkrétní typ (Int, Double).`;
    if (cls === 'Show' && isFn(t)) return 'Výsledek je funkce. Nejspíš jí chybí argument(y).';
    if ((cls === 'Eq' || cls === 'Ord') && isFn(t)) return 'Funkce nejde porovnávat. Nechybí jí argument nebo závorky?';
    if (cls === 'Num' && isCon(t, 'Bool')) {
      if (ctx === 'ifcond' || ctx === 'guard') return 'Podmínka musí být typu Bool, ale tady je to číslo (výsledek aritmetiky). Porovnej ho, např. a * 10 > 100.';
      return 'Míchá se číslo a logická hodnota (Bool). Tam, kde je číslo, se čeká True/False, nebo naopak.';
    }
    if (NUMERIC.has(cls) && isFn(t)) return 'Číslo se tu používá jako funkce, nebo funkci chybí argument či závorky. Pozor: f -1 znamená f mínus 1, piš f (-1); f n-1 znamená (f n) - 1, piš f (n-1).';
    if (NUMERIC.has(cls) && isList(t)) {
      const el = prune(t.args[0]);
      if (isCon(el, 'Char')) return 'Míchá se číslo a text (řetězec). Číslo na text převede show.';
      if (ctx === 'ifbranch') return 'Jedna větev if vrací číslo a druhá seznam. Obě větve musí mít stejný typ.';
      return 'Míchá se číslo a seznam: na jednom místě je číslo, jinde seznam. Pozor na rozdíl x : xs (prvek na začátek) a xs ++ ys (spojení seznamů); obě větve if i všechny klauzule musí vracet stejný typ.';
    }
    if ((cls === 'Fractional' || cls === 'Floating') && (isCon(t, 'Int') || isCon(t, 'Integer'))) {
      return 'Operátor / (a sqrt apod.) je pro desetinná čísla. Pro celá čísla použij div, nebo převeď hodnotu pomocí fromIntegral (např. fromIntegral (length xs) / 2).';
    }
    if ((cls === 'Integral') && isCon(t, 'Double')) return 'div, mod, even, odd… fungují jen pro celá čísla. Desetinné číslo převeď (round, truncate), nebo použij /.';
    if (NUMERIC.has(cls) && isCon(t, 'Char')) return 'Znak není číslo. Kód znaku vrátí ord, číslici převede digitToInt.';
    if (NUMERIC.has(cls) && isCon(t, 'Bool')) return 'Míchá se číslo a logická hodnota (Bool).';
    if (ctx && CTX_HINTS[ctx]) return CTX_HINTS[ctx];
    return '';
  }

  // ---------- unifikace ----------
  unify(expected, actual, ctx) {
    const saved = this.ctx;
    this.ctx = ctx || null;
    try {
      if (!this.u(expected, actual)) throw this.mismatch(expected, actual, ctx);
    } finally {
      this.ctx = saved;
    }
  }

  u(a, b) {
    a = prune(a); b = prune(b);
    if (a === b) return true;
    // dvě proměnné: mladší se naváže na starší, aby u omezení zůstal původ z dřívějšího místa (jako GHC)
    if (a instanceof TVar && b instanceof TVar) return a.id > b.id ? this.bindVar(a, b) : this.bindVar(b, a);
    if (a instanceof TVar) return this.bindVar(a, b);
    if (b instanceof TVar) return this.bindVar(b, a);
    if (a.k === 'skol' || b.k === 'skol') return false;
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    for (let i = 0; i < a.args.length; i++) if (!this.u(a.args[i], b.args[i])) return false;
    return true;
  }

  bindVar(v, t) {
    if (this.occurs(v, t)) {
      const namer = msgNamer();
      const vs = showType(v, namer);
      throw new HsError('type', `Occurs check: cannot construct the infinite type: ${vs} ~ ${showType(t, namer)}`, {
        line: this.ctx && this.ctx.at ? this.ctx.at.line : undefined,
        col: this.ctx && this.ctx.at ? this.ctx.at.col : undefined,
        hint: 'Typ by byl nekonečný. Nejspíš si pleteš prvek a seznam: x : xs dává prvek na začátek seznamu, ale x : x nebo [xs] ++ … ne. Zkontroluj, co je prvek a co seznam.',
      });
    }
    this.adjustLevels(t, v.level);
    v.ref = t;
    if (v.cls) for (const [c, origin] of v.cls) this.entail(c, t, origin);
    return true;
  }

  occurs(v, t) {
    t = prune(t);
    if (t === v) return true;
    if (t.k === 'con') return t.args.some((a) => this.occurs(v, a));
    return false;
  }

  adjustLevels(t, level) {
    t = prune(t);
    if (t instanceof TVar) { if (t.level > level) t.level = level; return; }
    if (t.k === 'con') for (const a of t.args) this.adjustLevels(a, level);
  }

  mismatch(expected, actual, ctx) {
    const namer = msgNamer();
    const e = showType(expected, namer), a = showType(actual, namer);
    let hint = '';
    const k = ctx && ctx.kind;
    const pe = prune(expected), pa = prune(actual);
    if (k === 'arg' || k === 'clause' || k === 'guardbody' || k === 'listelem' || k === 'ifbranch') {
      const elemOf = (l, x) => isList(l) && !isList(x) && couldUnify(prune(l).args[0], x);
      if ((elemOf(pe, pa) || elemOf(pa, pe)) && !(pe instanceof TVar) && !(pa instanceof TVar)) {
        hint = 'Pleteš si prvek a seznam: x : xs přidá prvek na začátek seznamu, xs ++ ys spojí dva seznamy (prvek musíš zabalit: [x] ++ xs).';
      }
    }
    if (!hint && (k === 'ifcond' || k === 'guard' || k === 'compguard') && isCon(pe, 'Bool')) hint = CTX_HINTS[k];
    if (!hint && k === 'arg' && ctx.fname) {
      hint = isFn(pa) && !isFn(pe)
        ? `Argument funkce ${ctx.fname} je funkce bez argumentů. Nechybí závorky, např. f (g x) místo f g x?`
        : `Funkce ${ctx.fname} dostala argument jiného typu, než čeká.`;
    }
    if (!hint && (pe.k === 'skol' || pa.k === 'skol')) hint = CTX_HINTS.sig;
    if (!hint && k && CTX_HINTS[k]) hint = CTX_HINTS[k];
    if (!hint && k === 'arity') hint = 'Funkce dostala jiný počet argumentů, než má.';
    const at = ctx && ctx.at;
    return new HsError('type', `Couldn't match expected type ‘${e}’ with actual type ‘${a}’`, { line: at && at.line, col: at && at.col, hint });
  }

  // ---------- instanciace / generalizace ----------
  instantiate(t, level, origin) {
    const map = new Map();
    const go = (t) => {
      t = prune(t);
      if (t instanceof TVar) {
        if (t.level !== GENERIC) return t;
        let v = map.get(t);
        if (!v) {
          v = new TVar(level);
          v.hint = t.hint;
          map.set(t, v);
          if (t.cls) for (const c of t.cls.keys()) this.addClass(v, c, origin);
        }
        return v;
      }
      if (t.k === 'con' && t.args.length) {
        const r = { k: 'con', name: t.name, args: t.args.map(go) };
        if (t.syn) r.syn = t.syn;
        return r;
      }
      return t;
    };
    return go(t);
  }

  generalize(t, level, clearHints) {
    t = prune(t);
    if (t instanceof TVar) {
      if (t.level > level && t.level !== GENERIC) { t.level = GENERIC; if (clearHints) t.hint = null; }
      return;
    }
    if (t.k === 'con') for (const a of t.args) this.generalize(a, level, clearHints);
  }

  // MR: proměnné s omezením tříd se negeneralizují (zůstanou na vnější úrovni a později se defaultují)
  generalizeRestricted(t, level) {
    const vars = collectVars(t, []);
    for (const v of vars) {
      if (v.level <= level || v.level === GENERIC) continue;
      if (v.cls && v.cls.size) v.level = level;
      else { v.level = GENERIC; v.hint = null; }
    }
  }

  defaultAmbiguous(level) {
    const keep = [];
    for (const v0 of this.pending) {
      const v = prune(v0);
      if (!(v instanceof TVar) || v.level === GENERIC) continue;
      if (v.level > level) this.defaultVar(v);
      else keep.push(v);
    }
    this.pending = keep;
  }

  defaultVar(v) {
    if (v.ref) return;
    const cls = v.cls ? [...v.cls.keys()] : [];
    const numeric = cls.some((c) => NUMERIC.has(c));
    const cands = numeric ? [tInteger, tDouble] : [tUnit];
    for (const c of cands) {
      if (cls.every((k) => instanceHolds(k, c))) { v.ref = c; return; }
    }
    const bad = cls.find((c) => NUMERIC.has(c)) || cls[0];
    const origin = v.cls.get(bad);
    const hasInt = cls.some((c) => closure(c).has('Integral') || c === 'Integral');
    const hasFrac = cls.some((c) => c === 'Fractional' || c === 'Floating' || c === 'RealFrac');
    throw new HsError('type', `Ambiguous type variable ‘a0’ arising from ${origin ? origin.text : 'an expression'} prevents the constraint ‘(${bad} a0)’ from being solved.`, {
      line: origin && origin.line, col: origin && origin.col,
      hint: hasInt && hasFrac
        ? 'Mícháš celočíselné operace (div, mod, even, length…) s desetinnými (/, sqrt…). Pro celá čísla použij div, nebo převeď pomocí fromIntegral.'
        : 'Typ výsledku nejde jednoznačně určit. Zkus doplnit typovou anotaci (např. :: Int).',
    });
  }

  // ---------- typové signatury ----------
  convertSig(sig, mode, level) {
    const vars = new Map();
    const ctxBy = new Map();
    for (const c of sig.ctx) {
      if (!CLASSES.has(c.cls)) {
        throw new HsError('scope', `Not in scope: type class ‘${c.cls}’`, { line: c.line, col: c.col, hint: 'Podporované třídy: Num, Integral, Fractional, Floating, Eq, Ord, Show, Enum, Real, RealFrac.' });
      }
      if (!ctxBy.has(c.v)) ctxBy.set(c.v, []);
      ctxBy.get(c.v).push(c.cls);
    }
    const getVar = (name) => {
      if (vars.has(name)) return vars.get(name);
      let v;
      const cls = ctxBy.get(name) || [];
      if (mode === 'skolem') v = { k: 'skol', name, cls: new Set(cls) };
      else {
        v = new TVar(mode === 'generic' ? GENERIC : level);
        v.hint = name;
        if (cls.length) {
          v.cls = new Map();
          for (const c of cls) v.cls.set(c, { text: 'a type signature' });
          if (mode !== 'generic') this.pending.push(v);
        }
      }
      vars.set(name, v);
      return v;
    };
    const conv = (t) => {
      switch (t.t) {
        case 'tvar': return getVar(t.name);
        case 'tcon':
          switch (t.name) {
            case 'Int': return tInt;
            case 'Integer': return tInteger;
            case 'Double': case 'Float': return tDouble;
            case 'Bool': return tBool;
            case 'Char': return tChar;
            case 'String': return tString();
            case '()': return tUnit;
            default:
              throw new HsError('scope', `Not in scope: type constructor or class ‘${t.name}’`, {
                line: t.line, col: t.col, hint: 'Podporované typy: Int, Integer, Double, Float, Bool, Char, String, seznamy [a], n-tice (a, b) a funkce a -> b.',
              });
          }
        case 'tlist': return tList(conv(t.el));
        case 'ttuple': return tTuple(t.items.map(conv));
        case 'tfun': return tFn(conv(t.a), conv(t.b));
        case 'tapp': {
          const f = t.f;
          throw new HsError('scope', `Not in scope: type constructor or class ‘${f.name || '?'}’`, {
            line: f.line, col: f.col, hint: 'Typové konstruktory jako Maybe tenhle trenažér nepodporuje.',
          });
        }
        default: throw new Error('convertSig ' + t.t);
      }
    };
    for (const c of sig.ctx) {
      if (!vars.has(c.v)) {
        // proměnná jen v kontextu: GHC hlásí chybu, my ji jen založíme
        getVar(c.v);
      }
    }
    return conv(sig.type);
  }

  // ---------- vazby ----------
  inferGroup(decls, env, level) {
    const binds = decls.filter((d) => d.t === 'fun' || d.t === 'pbind');
    const sigs = new Map();
    for (const d of decls) if (d.t === 'sig') for (const n of d.names) sigs.set(n, d);
    const newEnv = Object.create(env);
    for (const b of binds) {
      if (b.t === 'fun' && sigs.has(b.name)) newEnv[b.name] = this.convertSig(sigs.get(b.name).sig, 'generic', level);
    }
    for (const scc of sccs(binds)) {
      const lvl = level + 1;
      const monos = new Map();
      for (const b of scc) {
        if (b.t === 'fun' && !sigs.has(b.name)) { const v = new TVar(lvl); monos.set(b.name, v); newEnv[b.name] = v; }
        if (b.t === 'pbind') for (const n of patBinders(b.pat)) { const v = new TVar(lvl); monos.set(n.name, v); newEnv[n.name] = v; }
      }
      for (const b of scc) {
        if (b.t === 'fun') {
          if (sigs.has(b.name)) this.checkSig(b, sigs.get(b.name), newEnv, lvl);
          else this.unify(monos.get(b.name), this.inferFun(b, newEnv, lvl), { kind: 'clause', at: b });
        } else {
          const binds2 = new Map();
          const tp = this.inferPat(b.pat, binds2, lvl);
          const tr = this.inferRhsWhere(b.rhs, b.where, newEnv, lvl, null);
          this.unify(tp, tr, { kind: 'pat', at: b });
          for (const [n, t] of binds2) this.unify(monos.get(n), t, { kind: 'pat', at: b });
        }
      }
      for (const b of scc) {
        if (b.t === 'fun' && !sigs.has(b.name)) {
          if (this.mr && b.clauses[0].pats.length === 0) this.generalizeRestricted(monos.get(b.name), level);
          else this.generalize(monos.get(b.name), level, true);
        }
        if (b.t === 'pbind') for (const n of patBinders(b.pat)) this.adjustLevels(monos.get(n.name), level);
      }
      this.defaultAmbiguous(level);
    }
    return newEnv;
  }

  checkSig(b, sigDecl, env, lvl) {
    const expected = this.convertSig(sigDecl.sig, 'skolem', lvl);
    const arity = b.clauses[0].pats.length;
    let n = 0, t = expected;
    while (isFn(t)) { n++; t = prune(t).args[1]; }
    if (arity > n) {
      const c = b.clauses[0];
      throw new HsError('type', `The equation for ‘${b.name}’ has ${arity} argument${arity === 1 ? '' : 's'}, but its type ‘${showType(expected)}’ has only ${n}`, {
        line: c.line, col: c.col, hint: `Podle signatury má ${b.name} ${n} argument(y), ale v definici je jich ${arity}.`,
      });
    }
    const inferred = this.inferFun(b, env, lvl, expected);
    this.unify(expected, inferred, { kind: 'sig', at: b });
  }

  inferFun(b, env, lvl, expected) {
    const arity = b.clauses[0].pats.length;
    const args = [];
    let res;
    // s očekávaným typem (signatura) rovnou dosadíme typy argumentů → lepší chybové hlášky
    if (expected) {
      let t = expected;
      for (let i = 0; i < arity; i++) { t = prune(t); args.push(t.args[0]); t = t.args[1]; }
      res = t;
    } else {
      for (let i = 0; i < arity; i++) args.push(new TVar(lvl));
      res = new TVar(lvl);
    }
    for (const c of b.clauses) {
      const binds = new Map();
      for (let i = 0; i < arity; i++) {
        const tp = this.inferPat(c.pats[i], binds, lvl);
        this.unify(args[i], tp, { kind: expected ? 'sig' : 'pat', at: c.pats[i] });
      }
      const env2 = Object.create(env);
      for (const [n, t] of binds) env2[n] = t;
      const tr = this.inferRhsWhere(c.rhs, c.where, env2, lvl, res, expected ? 'sig' : 'clause');
      if (tr !== res) this.unify(res, tr, { kind: expected ? 'sig' : 'clause', at: c });
    }
    return fnChain(args, res);
  }

  inferRhsWhere(rhs, where, env, lvl, res, kind) {
    const env2 = where ? this.inferGroup(where, env, lvl) : env;
    return this.inferRhs(rhs, env2, lvl, res, kind);
  }

  // vrací typ pravé strany; je-li zadán res, unifikuje rovnou s ním
  inferRhs(rhs, env, lvl, res, kind) {
    if (rhs.t === 'plain') {
      const t = this.infer(rhs.body, env, lvl);
      if (res) { this.unify(res, t, { kind: kind || 'clause', at: rhs.body }); return res; }
      return t;
    }
    let r = res;
    for (const g of rhs.guards) {
      const tc = this.infer(g.cond, env, lvl);
      this.unify(tBool, tc, { kind: 'guard', at: g.cond });
      const tb = this.infer(g.body, env, lvl);
      if (r) this.unify(r, tb, { kind: kind === 'sig' ? 'sig' : 'guardbody', at: g.body });
      else r = tb;
    }
    return r;
  }

  // ---------- vzory ----------
  inferPat(p, binds, lvl) {
    let t;
    switch (p.t) {
      case 'pvar': t = new TVar(lvl); binds.set(p.name, t); break;
      case 'pwild': t = new TVar(lvl); break;
      case 'plit': {
        const L = p.lit;
        const origin = { text: `the literal ‘${litText(L)}’`, line: p.line, col: p.col };
        if (L.kind === 'int' || L.kind === 'float') {
          t = new TVar(lvl);
          this.addClass(t, 'Eq', origin);
          this.addClass(t, L.kind === 'int' ? 'Num' : 'Fractional', origin);
        } else if (L.kind === 'char') t = tChar;
        else t = tString();
        break;
      }
      case 'pcon':
        if (p.name === 'True' || p.name === 'False') t = tBool;
        else if (p.name === '()') t = tUnit;
        else if (p.name === ':') {
          const th = this.inferPat(p.args[0], binds, lvl);
          const tt = this.inferPat(p.args[1], binds, lvl);
          this.unify(tList(th), tt, { kind: 'pat', at: p });
          t = tt;
        } else throw new HsError('scope', `Not in scope: data constructor ‘${p.name}’`, { line: p.line, col: p.col });
        break;
      case 'plist': {
        const a = new TVar(lvl);
        for (const it of p.items) this.unify(a, this.inferPat(it, binds, lvl), { kind: 'listelem', at: it });
        t = tList(a);
        break;
      }
      case 'ptuple': t = tTuple(p.items.map((it) => this.inferPat(it, binds, lvl))); break;
      case 'pas': t = this.inferPat(p.pat, binds, lvl); binds.set(p.name, t); break;
      default: throw new Error('inferPat ' + p.t);
    }
    p.ty = t;
    return t;
  }

  // ---------- výrazy ----------
  applyType(tf, ta, lvl, ctx) {
    const pf = prune(tf);
    if (pf.k === 'con' && pf.name === '->') {
      this.unify(pf.args[0], ta, ctx);
      return pf.args[1];
    }
    const r = new TVar(lvl);
    this.unify(tFn(ta, r), tf, { ...ctx, kind: 'apply' });
    return r;
  }

  lookupVar(env, name, at) {
    const t = env[name];
    if (t === undefined) throw new HsError('scope', `Variable not in scope: ${name}`, { line: at.line, col: at.col });
    return t;
  }

  infer(e, env, lvl) {
    const t = this.infer0(e, env, lvl);
    e.ty = t;
    return t;
  }

  infer0(e, env, lvl) {
    switch (e.t) {
      case 'lit': {
        const L = e.lit;
        if (L.kind === 'int' || L.kind === 'float') {
          const v = new TVar(lvl);
          this.addClass(v, L.kind === 'int' ? 'Num' : 'Fractional', { text: `the literal ‘${e.text || litText(L)}’`, line: e.line, col: e.col });
          return v;
        }
        if (L.kind === 'char') return tChar;
        return tString();
      }
      case 'var': {
        if (e.tupleCon) {
          const vs = []; for (let i = 0; i < e.tupleCon; i++) vs.push(new TVar(lvl));
          return fnChain(vs, tTuple(vs));
        }
        const t = this.lookupVar(env, e.name, e);
        const disp = /^[\p{L}_]/u.test(e.name) ? e.name : e.name;
        return this.instantiate(t, lvl, { text: `a use of ‘${disp}’`, line: e.line, col: e.col });
      }
      case 'con':
        if (e.name === 'True' || e.name === 'False') return tBool;
        if (e.name === '()') return tUnit;
        throw new HsError('scope', `Data constructor not in scope: ${e.name}`, { line: e.line, col: e.col });
      case 'app': {
        const tf = this.infer(e.f, env, lvl);
        const ta = this.infer(e.a, env, lvl);
        return this.applyType(tf, ta, lvl, { kind: 'arg', at: e.a, fname: headName(e.f) });
      }
      case 'binop': {
        const op = e.op;
        const top = this.instantiate(this.lookupVar(env, op.name, op), lvl, { text: `a use of ‘${op.name}’`, line: op.line, col: op.col });
        op.ty = top;
        const tl = this.infer(e.l, env, lvl);
        const t1 = this.applyType(top, tl, lvl, { kind: 'arg', at: e.l, fname: op.name });
        const tr = this.infer(e.r, env, lvl);
        return this.applyType(t1, tr, lvl, { kind: 'arg', at: e.r, fname: op.name });
      }
      case 'neg': {
        const tneg = this.instantiate(this.lookupVar(env, 'negate', e), lvl, { text: 'a use of ‘-’', line: e.line, col: e.col });
        const te = this.infer(e.e, env, lvl);
        return this.applyType(tneg, te, lvl, { kind: 'arg', at: e.e, fname: '-' });
      }
      case 'sectionL': {
        const op = e.op;
        const top = this.instantiate(this.lookupVar(env, op.name, op), lvl, { text: `a use of ‘${op.name}’`, line: op.line, col: op.col });
        op.ty = top;
        const te = this.infer(e.e, env, lvl);
        return this.applyType(top, te, lvl, { kind: 'arg', at: e.e, fname: op.name });
      }
      case 'sectionR': {
        const op = e.op;
        const top = this.instantiate(this.lookupVar(env, op.name, op), lvl, { text: `a use of ‘${op.name}’`, line: op.line, col: op.col });
        op.ty = top;
        const a = new TVar(lvl), b = new TVar(lvl), c = new TVar(lvl);
        this.unify(tFn(a, tFn(b, c)), top, { kind: 'apply', at: op });
        const te = this.infer(e.e, env, lvl);
        this.unify(b, te, { kind: 'arg', at: e.e, fname: op.name });
        return tFn(a, c);
      }
      case 'paren': return this.infer(e.e, env, lvl);
      case 'ann': {
        const te = this.infer(e.e, env, lvl);
        const ta = this.convertSig(e.sig, 'fresh', lvl);
        this.unify(ta, te, { kind: 'ann', at: e.e });
        return ta;
      }
      case 'lam': {
        const binds = new Map();
        const ts = e.pats.map((p) => this.inferPat(p, binds, lvl));
        const env2 = Object.create(env);
        for (const [n, t] of binds) env2[n] = t;
        return fnChain(ts, this.infer(e.body, env2, lvl));
      }
      case 'let': {
        const env2 = this.inferGroup(e.decls, env, lvl);
        return this.infer(e.body, env2, lvl);
      }
      case 'if': {
        const tc = this.infer(e.c, env, lvl);
        this.unify(tBool, tc, { kind: 'ifcond', at: e.c });
        const tt = this.infer(e.th, env, lvl);
        const te = this.infer(e.el, env, lvl);
        this.unify(tt, te, { kind: 'ifbranch', at: e.el });
        return tt;
      }
      case 'case': {
        const ts = this.infer(e.scrut, env, lvl);
        const r = new TVar(lvl);
        for (const a of e.alts) {
          const binds = new Map();
          const tp = this.inferPat(a.pat, binds, lvl);
          this.unify(ts, tp, { kind: 'casepat', at: a.pat });
          const env2 = Object.create(env);
          for (const [n, t] of binds) env2[n] = t;
          this.inferRhsWhere(a.rhs, a.where, env2, lvl, r, 'casealt');
        }
        return r;
      }
      case 'tuple': return tTuple(e.items.map((x) => this.infer(x, env, lvl)));
      case 'list': {
        const a = new TVar(lvl);
        for (const x of e.items) this.unify(a, this.infer(x, env, lvl), { kind: 'listelem', at: x });
        return tList(a);
      }
      case 'range': {
        const t = this.infer(e.from, env, lvl);
        this.entail('Enum', t, { text: 'an arithmetic sequence', line: e.line, col: e.col });
        if (e.then) this.unify(t, this.infer(e.then, env, lvl), { kind: 'listelem', at: e.then });
        if (e.to) this.unify(t, this.infer(e.to, env, lvl), { kind: 'listelem', at: e.to });
        return tList(t);
      }
      case 'comp': {
        let env2 = env;
        for (const q of e.quals) {
          if (q.t === 'qgen') {
            const te = this.infer(q.e, env2, lvl);
            const binds = new Map();
            const tp = this.inferPat(q.pat, binds, lvl);
            this.unify(tList(tp), te, { kind: 'gen', at: q.e });
            env2 = Object.create(env2);
            for (const [n, t] of binds) env2[n] = t;
          } else if (q.t === 'qguard') {
            this.unify(tBool, this.infer(q.e, env2, lvl), { kind: 'compguard', at: q.e });
          } else {
            env2 = this.inferGroup(q.decls, env2, lvl);
          }
        }
        return tList(this.infer(e.e, env2, lvl));
      }
      default: throw new Error('infer: neznámý uzel ' + e.t);
    }
  }
}

// strukturní test bez navazování: proměnné jsou žolíky
function couldUnify(a, b) {
  a = prune(a); b = prune(b);
  if (a instanceof TVar || b instanceof TVar) return true;
  if (a.k === 'skol' || b.k === 'skol') return a === b;
  if (a.name !== b.name || a.args.length !== b.args.length) return false;
  return a.args.every((x, i) => couldUnify(x, b.args[i]));
}

function headName(f) {
  while (f.t === 'app') f = f.f;
  while (f.t === 'paren') f = f.e;
  return f.t === 'var' ? f.name : null;
}

function litText(L) {
  if (L.kind === 'int') return L.value.toString();
  if (L.kind === 'float') return String(L.value);
  if (L.kind === 'char') return JSON.stringify(L.value);
  return JSON.stringify(L.value.join(''));
}

// Tarjan: silně souvislé komponenty, závislosti dřív než závislé.
export function sccs(binds) {
  const byKey = new Map(binds.map((b) => [b.key, b]));
  let index = 0;
  const idx = new Map(), low = new Map(), onStack = new Set(), stack = [], out = [];
  const visit = (b) => {
    idx.set(b, index); low.set(b, index); index++;
    stack.push(b); onStack.add(b);
    for (const k of b.deps || []) {
      const w = byKey.get(k);
      if (!w) continue;
      if (!idx.has(w)) { visit(w); low.set(b, Math.min(low.get(b), low.get(w))); }
      else if (onStack.has(w)) low.set(b, Math.min(low.get(b), idx.get(w)));
    }
    if (low.get(b) === idx.get(b)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== b);
      out.push(comp.reverse());
    }
  };
  for (const b of binds) if (!idx.has(b)) visit(b);
  return out;
}
