// Překlad AST do generátorů (env) => WHNF hodnota. Generátor yielduje Thunk (vynuť) nebo Call (zavolej).
// V koncové pozici smí vrátit TailCall (stroj ho provede bez růstu zásobníku).

import {
  Thunk, Cons, NIL, Tup, UNIT, Fn, TailCall, Call, W, lazyG, rtError, fromArray,
  numAdd, numSub, numMul, numNeg, numDivide, intDiv, intMod, intQuot, intRem, numPow, hsEqG, hsCmpG,
  enumFrom, enumFromTo, enumFromThen, enumFromThenTo,
} from './runtime.js';
import { prune } from './types.js';
import { patVarNames } from './scope.js';

const FALL = { fall: true };
const EMPTY = [];

const isDoubleTy = (t) => { if (!t) return false; t = prune(t); return t.k === 'con' && t.name === 'Double'; };

const ARITH = {
  '+': numAdd, '-': numSub, '*': numMul, '/': numDivide,
  div: intDiv, mod: intMod, quot: intQuot, rem: intRem, '^': numPow,
};
const CMP = {
  '<': (c) => c < 0, '<=': (c) => c <= 0, '>': (c) => c > 0, '>=': (c) => c >= 0,
};

function strip(e) { while (e.t === 'paren' || e.t === 'ann') e = e.e; return e; }

// Zkompilovaný uzel: generátorová funkce s volitelnými příznaky pro rychlou cestu:
//   c.isLit + c.val  – konstanta;  c.vname – proměnná
function mkLit(v) {
  const g = function* () { return v; };
  g.isLit = true; g.val = v;
  return g;
}
function mkVar(name) {
  const g = function* (env) {
    const x = env[name];
    if (x instanceof Thunk) return x.s === 2 ? x.v : yield x;
    return x;
  };
  g.vname = name;
  return g;
}

export function delayed(e) {
  const s = strip(e);
  if (s.t === 'var' && !s.tupleCon) { const name = s.name; return (env) => env[name]; }
  const c = compileExpr(e, true);
  if (c.isLit) { const v = c.val; return () => v; }
  return (env) => new Thunk(c, env, true);
}

function litValue(e) {
  const L = e.lit;
  switch (L.kind) {
    case 'int': return isDoubleTy(e.ty) ? Number(L.value) : L.value;
    case 'float': return L.value;
    case 'char': return L.value;
    default: return fromArray(L.value);
  }
}

export function compileExpr(e, tail) {
  switch (e.t) {
    case 'lit': return mkLit(litValue(e));
    case 'con': return mkLit(e.name === 'True' ? true : e.name === 'False' ? false : UNIT);
    case 'var': {
      if (e.tupleCon) return mkLit(new Fn(e.tupleCon, function* (args) { return new Tup(args); }, EMPTY, '(,)'));
      return mkVar(e.name);
    }
    case 'paren': case 'ann': return compileExpr(e.e, tail);
    case 'app': {
      let f = e; const args = [];
      while (f.t === 'app') { args.unshift(f.a); f = f.f; }
      const fc = compileExpr(f, false);
      const ac = args.map(delayed);
      const n = ac.length;
      const fname = fc.vname;
      return function* (env) {
        let fv;
        if (fname !== undefined) { fv = env[fname]; if (fv instanceof Thunk) fv = fv.s === 2 ? fv.v : yield fv; }
        else fv = yield* fc(env);
        const as = new Array(n);
        for (let i = 0; i < n; i++) as[i] = ac[i](env);
        if (tail) return new TailCall(fv, as);
        return yield new Call(fv, as);
      };
    }
    case 'binop': return compileBinop(e, tail);
    case 'neg': {
      const inner = strip(e.e);
      if (inner.t === 'lit' && (inner.lit.kind === 'int' || inner.lit.kind === 'float')) return mkLit(numNeg(litValue(inner)));
      const c = compileExpr(e.e, false);
      return function* (env) { return numNeg(yield* c(env)); };
    }
    case 'sectionL': {
      const opv = mkVar(e.op.name);
      const d = delayed(e.e);
      return function* (env) { const f = yield* opv(env); return yield new Call(f, [d(env)]); };
    }
    case 'sectionR': {
      const opv = mkVar(e.op.name);
      const d = delayed(e.e);
      return function* (env) {
        const f = yield* opv(env);
        const y = d(env);
        return new Fn(1, function* (args) { return new TailCall(f, [args[0], y]); }, EMPTY, 'section');
      };
    }
    case 'lam': {
      const ms = e.pats.map(compilePat);
      const body = compileExpr(e.body, true);
      const n = ms.length;
      return function* (env) {
        return new Fn(n, function* (args) {
          const env2 = Object.create(env);
          for (let i = 0; i < n; i++) {
            if (!(yield* matchArg(ms[i], args[i], env2))) throw rtError('Non-exhaustive patterns in lambda');
          }
          return yield* body(env2);
        }, EMPTY, 'lambda');
      };
    }
    case 'let': {
      const bind = compileDecls(e.decls);
      const body = compileExpr(e.body, tail);
      return function* (env) { const env2 = Object.create(env); bind(env2); return yield* body(env2); };
    }
    case 'if': {
      const c = compileExpr(e.c, false);
      const th = compileExpr(e.th, tail);
      const el = compileExpr(e.el, tail);
      return function* (env) { return (yield* c(env)) === true ? yield* th(env) : yield* el(env); };
    }
    case 'case': {
      const sc = delayed(e.scrut);
      const alts = e.alts.map((a) => ({
        m: compilePat(a.pat),
        where: a.where ? compileDecls(a.where) : null,
        rhs: compileRhs(a.rhs, tail),
      }));
      return function* (env) {
        const v = sc(env);
        for (const a of alts) {
          const env2 = Object.create(env);
          if (!(yield* matchArg(a.m, v, env2))) continue;
          if (a.where) a.where(env2);
          const r = yield* a.rhs(env2);
          if (r !== FALL) return r;
        }
        throw rtError('Non-exhaustive patterns in case', 'Žádná alternativa case nepasuje na tuto hodnotu.');
      };
    }
    case 'tuple': {
      const ds = e.items.map(delayed);
      return function* (env) { return new Tup(ds.map((d) => d(env))); };
    }
    case 'list': {
      const ds = e.items.map(delayed);
      return function* (env) {
        let l = NIL;
        for (let i = ds.length - 1; i >= 0; i--) l = new Cons(ds[i](env), l);
        return l;
      };
    }
    case 'range': {
      const f = compileExpr(e.from, false);
      const th = e.then ? compileExpr(e.then, false) : null;
      const to = e.to ? compileExpr(e.to, false) : null;
      return function* (env) {
        const a = yield* f(env);
        if (th) {
          const a2 = yield* th(env);
          return to ? enumFromThenTo(a, a2, yield* to(env)) : enumFromThen(a, a2);
        }
        return to ? enumFromTo(a, yield* to(env)) : enumFrom(a);
      };
    }
    case 'comp': return compileComp(e);
    default: throw new Error('compile: neznámý uzel ' + e.t);
  }
}

// operand v generátoru s rychlou cestou pro konstanty a proměnné
function operand(c) { return c; }

function compileBinop(e, tail) {
  const name = e.op.name;
  const prelude = e.op.ref === 'prelude';
  if (prelude && ARITH[name]) {
    const f = ARITH[name];
    const l = operand(compileExpr(e.l, false)), r = operand(compileExpr(e.r, false));
    const lv = l.vname, rv = r.vname, ll = l.isLit, rl = r.isLit;
    return function* (env) {
      let a, b;
      if (ll) a = l.val;
      else if (lv !== undefined) { a = env[lv]; if (a instanceof Thunk) a = a.s === 2 ? a.v : yield a; }
      else a = yield* l(env);
      if (rl) b = r.val;
      else if (rv !== undefined) { b = env[rv]; if (b instanceof Thunk) b = b.s === 2 ? b.v : yield b; }
      else b = yield* r(env);
      return f(a, b);
    };
  }
  if (prelude && (name === '==' || name === '/=')) {
    const l = delayed(e.l), r = delayed(e.r);
    const neg = name === '/=';
    return function* (env) { const x = yield* hsEqG(l(env), r(env)); return neg ? !x : x; };
  }
  if (prelude && CMP[name]) {
    const test = CMP[name];
    const l = delayed(e.l), r = delayed(e.r);
    return function* (env) { return test(yield* hsCmpG(l(env), r(env))); };
  }
  if (prelude && name === '&&') {
    const l = compileExpr(e.l, false), r = compileExpr(e.r, tail);
    return function* (env) { return (yield* l(env)) === true ? yield* r(env) : false; };
  }
  if (prelude && name === '||') {
    const l = compileExpr(e.l, false), r = compileExpr(e.r, tail);
    return function* (env) { return (yield* l(env)) === true ? true : yield* r(env); };
  }
  if (name === ':') {
    const l = delayed(e.l), r = delayed(e.r);
    return function* (env) { return new Cons(l(env), r(env)); };
  }
  if (prelude && name === '$') {
    const l = compileExpr(e.l, false), r = delayed(e.r);
    return function* (env) {
      const f = yield* l(env);
      if (tail) return new TailCall(f, [r(env)]);
      return yield new Call(f, [r(env)]);
    };
  }
  if (prelude && name === 'seq') {
    const l = compileExpr(e.l, false), r = compileExpr(e.r, tail);
    return function* (env) { yield* l(env); return yield* r(env); };
  }
  const opv = mkVar(name);
  const l = delayed(e.l), r = delayed(e.r);
  return function* (env) {
    const f = yield* opv(env);
    if (tail) return new TailCall(f, [l(env), r(env)]);
    return yield new Call(f, [l(env), r(env)]);
  };
}

function compileRhs(rhs, tail) {
  if (rhs.t === 'plain') return compileExpr(rhs.body, tail);
  const gs = rhs.guards.map((g) => [compileExpr(g.cond, false), compileExpr(g.body, tail)]);
  return function* (env) {
    for (let i = 0; i < gs.length; i++) {
      if ((yield* gs[i][0](env)) === true) return yield* gs[i][1](env);
    }
    return FALL;
  };
}

// ---------- vzory ----------
// Matcher: generátor (v, env) -> bool; rychlá cesta: m.bvar (proměnná), m.wild
function* matchArg(m, v, env) {
  if (m.bvar !== undefined) { env[m.bvar] = v; return true; }
  if (m.wild) return true;
  return yield* m(v, env);
}

export function compilePat(p) {
  switch (p.t) {
    case 'pvar': {
      const name = p.name;
      const m = function* (v, env) { env[name] = v; return true; };
      m.bvar = name;
      return m;
    }
    case 'pwild': { const m = function* () { return true; }; m.wild = true; return m; }
    case 'plit': {
      const L = p.lit;
      if (L.kind === 'int' || L.kind === 'float') { const n = L.value; return function* (v) { return (yield* W(v)) == n; }; } // eslint-disable-line eqeqeq
      if (L.kind === 'char') { const c = L.value; return function* (v) { return (yield* W(v)) === c; }; }
      const chars = L.value;
      return function* (v) {
        let x = yield* W(v);
        for (const c of chars) {
          if (!(x instanceof Cons) || (yield* W(x.h)) !== c) return false;
          x = yield* W(x.t);
        }
        return x === NIL;
      };
    }
    case 'pcon': {
      if (p.name === 'True') return function* (v) { return (yield* W(v)) === true; };
      if (p.name === 'False') return function* (v) { return (yield* W(v)) === false; };
      if (p.name === '()') return function* (v) { yield* W(v); return true; };
      const mh = compilePat(p.args[0]), mt = compilePat(p.args[1]);
      return function* (v, env) {
        const x = yield* W(v);
        if (!(x instanceof Cons)) return false;
        return (yield* matchArg(mh, x.h, env)) && (yield* matchArg(mt, x.t, env));
      };
    }
    case 'plist': {
      const ms = p.items.map(compilePat);
      return function* (v, env) {
        let x = yield* W(v);
        for (const m of ms) {
          if (!(x instanceof Cons)) return false;
          if (!(yield* matchArg(m, x.h, env))) return false;
          x = yield* W(x.t);
        }
        return x === NIL;
      };
    }
    case 'ptuple': {
      const ms = p.items.map(compilePat);
      return function* (v, env) {
        const x = yield* W(v);
        for (let i = 0; i < ms.length; i++) if (!(yield* matchArg(ms[i], x.xs[i], env))) return false;
        return true;
      };
    }
    case 'pas': {
      const name = p.name, m = compilePat(p.pat);
      return function* (v, env) { env[name] = v; return yield* matchArg(m, v, env); };
    }
    default: throw new Error('compilePat ' + p.t);
  }
}

const NON_EXH_HINT = (name) => `Funkce ${name} nemá vzor ani stráž pro tento vstup. Chybí třeba případ pro prázdný seznam [], pro 0, nebo větev otherwise.`;

// Vrací (env) => void, který do env přidá (rekurzivní) vazby.
export function compileDecls(decls) {
  const items = [];
  for (const d of decls) {
    if (d.t === 'fun') {
      const name = d.name;
      const arity = d.clauses[0].pats.length;
      const clauses = d.clauses.map((cl) => ({
        ms: cl.pats.map(compilePat),
        where: cl.where ? compileDecls(cl.where) : null,
        rhs: compileRhs(cl.rhs, true),
      }));
      if (arity === 0) {
        const cl = clauses[0];
        const code = function* (env) {
          let e3 = env;
          if (cl.where) { e3 = Object.create(env); cl.where(e3); }
          const r = yield* cl.rhs(e3);
          if (r === FALL) throw rtError(`Non-exhaustive guards in ${name}`, NON_EXH_HINT(name));
          return r;
        };
        items.push((env) => { env[name] = new Thunk(code, env, true); });
      } else {
        const nc = clauses.length;
        const mk = (env) => function* (args) {
          for (let c = 0; c < nc; c++) {
            const cl = clauses[c];
            const env2 = Object.create(env);
            let ok = true;
            for (let i = 0; i < arity; i++) {
              const m = cl.ms[i];
              if (m.bvar !== undefined) env2[m.bvar] = args[i];
              else if (!m.wild && !(yield* m(args[i], env2))) { ok = false; break; }
            }
            if (!ok) continue;
            if (cl.where) cl.where(env2);
            const r = yield* cl.rhs(env2);
            if (r !== FALL) return r;
          }
          throw rtError(`Non-exhaustive patterns in function ${name}`, NON_EXH_HINT(name));
        };
        items.push((env) => { env[name] = new Fn(arity, mk(env), EMPTY, name); });
      }
    } else if (d.t === 'pbind') {
      const pm = compilePat(d.pat);
      const vars = patVarNames(d.pat);
      const rhs = compileRhs(d.rhs, true);
      const where = d.where ? compileDecls(d.where) : null;
      items.push((env) => {
        const whole = new Thunk(function* (e) {
          let e3 = e;
          if (where) { e3 = Object.create(e); where(e3); }
          const r = yield* rhs(e3);
          if (r === FALL) throw rtError('Non-exhaustive guards in pattern binding');
          return r;
        }, env, true);
        let matched = null;
        const getM = function* () {
          if (!matched) {
            const tmp = Object.create(null);
            if (!(yield* matchArg(pm, whole, tmp))) throw rtError('Irrefutable pattern failed', 'Hodnota neodpovídá vzoru na levé straně definice.');
            matched = tmp;
          }
          return matched;
        };
        for (const v of vars) env[v] = lazyG(function* () { const m = yield* getM(); return yield* W(m[v]); });
      });
    }
  }
  return (env) => { for (let i = 0; i < items.length; i++) items[i](env); };
}

function compileComp(e) {
  const body = delayed(e.e);
  const qs = e.quals.map((q) => {
    if (q.t === 'qgen') return { k: 'gen', m: compilePat(q.pat), src: compileExpr(q.e, false) };
    if (q.t === 'qguard') return { k: 'guard', c: compileExpr(q.e, false) };
    return { k: 'let', d: compileDecls(q.decls) };
  });
  const SKIP = { skip: true };
  const n = qs.length;
  function* build(i, env, rest) {
    for (;;) {
      if (i === n) return new Cons(body(env), rest);
      const q = qs[i];
      if (q.k === 'guard') { if ((yield* q.c(env)) !== true) return SKIP; i++; continue; }
      if (q.k === 'let') { env = Object.create(env); q.d(env); i++; continue; }
      return yield* go(i, env, yield* q.src(env), rest);
    }
  }
  function* go(i, env, xs, rest) {
    const q = qs[i];
    for (;;) {
      const c = yield* W(xs);
      if (!(c instanceof Cons)) return SKIP;
      const env2 = Object.create(env);
      const tl = c.t;
      if (yield* matchArg(q.m, c.h, env2)) {
        const restThunk = lazyG(function* () {
          const r = yield* go(i, env, tl, rest);
          return r === SKIP ? yield* W(rest) : r;
        });
        const r = yield* build(i + 1, env2, restThunk);
        if (r !== SKIP) return r;
      }
      xs = tl;
    }
  }
  return function* (env) { const r = yield* build(0, env, NIL); return r === SKIP ? NIL : r; };
}
