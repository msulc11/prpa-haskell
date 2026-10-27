// Kontrola rozsahu platnosti jmen (jako renamer v GHC) + závislosti vazeb pro SCC.

import { HsError } from './errors.js';

const ALLOWED_CONS = new Set(['True', 'False', '()']);
const isOpName = (n) => !/^[\p{L}_]/u.test(n);

export function patBinders(p, out = []) {
  switch (p.t) {
    case 'pvar': out.push(p); break;
    case 'pas': out.push(p); patBinders(p.pat, out); break;
    case 'pcon': for (const a of p.args) patBinders(a, out); break;
    case 'plist': case 'ptuple': for (const a of p.items) patBinders(a, out); break;
    default: break;
  }
  return out;
}

export function patVarNames(p) { return patBinders(p).map((b) => b.name); }

const SPECIAL_HINTS = {
  '!=': 'Nerovná se se v Haskellu píše /= (ne !=).',
  '=<': 'Menší nebo rovno se píše <=.',
  '=>': 'Větší nebo rovno se píše >=.',
  '<>': 'Nerovná se se v Haskellu píše /=.',
  '%': 'Zbytek po dělení je funkce mod, např. a `mod` 2.',
  '&': 'Logické „a zároveň“ se píše &&.',
  '!': 'Negace je funkce not, např. not (a < b).',
  '//': 'Celočíselné dělení je div, např. a `div` 2.',
  '===': 'Porovnání se píše ==.',
  true: 'Logické hodnoty se píšou velkým písmenem: True a False.',
  false: 'Logické hodnoty se píšou velkým písmenem: True a False.',
  print: 'print tu není potřeba. Výsledek výrazu se v konzoli vypíše sám.',
  putStrLn: 'Výstup (IO) tenhle trenažér nepodporuje. Výsledek výrazu se vypíše sám.',
  len: 'Délka seznamu je length.',
  size: 'Délka seznamu je length.',
  pow: 'Mocnina: x ^ n (celočíselný exponent), x ** y (desetinná čísla).',
  sqr: 'Druhá mocnina: x ^ 2 nebo x * x.',
  modulo: 'Zbytek po dělení je mod.',
  elif: 'Haskell nemá elif. Použij else if … nebo stráže |.',
  elseif: 'Haskell nemá elseif. Použij else if … nebo stráže |.',
  nil: 'Prázdný seznam se píše [].',
  null: 'Test na prázdný seznam je funkce null, např. null xs.',
  lookup: 'lookup vrací typ Maybe, který tenhle trenažér nepodporuje. Napiš si vyhledání vlastní rekurzí nebo generátorem seznamu.',
  read: 'read tenhle trenažér nepodporuje. Čísla piš přímo do výrazu.',
};

const MAYBE_CONS = new Set(['Just', 'Nothing', 'Left', 'Right', 'Maybe', 'Either']);

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d.push([i]); }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export class Scoper {
  // env: { lookupGlobal(name) -> 'repl'|'module'|'prelude'|'ambiguous'|null, preludeHas(name), allNames() }
  constructor(env) {
    this.env = env;
    this.stack = [];
  }

  lookup(name, at) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const s = this.stack[i];
      if (s.names.has(name)) {
        if (s.group && s.group.current !== null) {
          const key = s.group.nameToKey.get(name);
          s.group.deps.get(s.group.current).add(key);
        }
        if (s.isModule && this.env.preludeHas(name)) this.ambiguous(name, at);
        return s.isModule ? 'module' : 'local';
      }
    }
    const g = this.env.lookupGlobal(name);
    if (g === 'ambiguous') this.ambiguous(name, at);
    return g;
  }

  ambiguous(name, at) {
    throw new HsError('scope', `Ambiguous occurrence ‘${name}’. It could refer to either ‘Prelude.${name}’ or ‘Main.${name}’`, {
      line: at.line, col: at.col,
      hint: `Jméno ${name} už existuje ve standardní knihovně (Prelude). Přejmenuj svou funkci, např. na ${name}' nebo moje${name[0].toUpperCase()}${name.slice(1)}.`,
    });
  }

  notInScope(name, at) {
    const disp = isOpName(name) ? `(${name})` : name;
    let hint = SPECIAL_HINTS[name] || '';
    if (!hint) {
      const cands = new Set(this.env.allNames());
      for (const s of this.stack) for (const n of s.names) cands.add(n);
      let best = null, bestD = 3;
      const opName = isOpName(name);
      for (const c of cands) {
        if (c === name || c.startsWith('%') || isOpName(c) !== opName) continue;
        if (name.length <= 2 && c.toLowerCase() !== name.toLowerCase()) continue;
        const d = editDistance(name.toLowerCase(), c.toLowerCase());
        if (d < bestD || (d === bestD && best && c.length === name.length)) { best = c; bestD = d; }
      }
      if (best && bestD <= (name.length <= 3 ? 1 : 2)) hint = `Možná máš na mysli ‘${best}’? Jména rozlišují malá a velká písmena.`;
      else hint = `Funkce ani proměnná ${disp} tu neexistuje. Překlep, nebo chybí její definice (nebo není v rozsahu, např. proměnná z jiné funkce).`;
    }
    throw new HsError('scope', `Variable not in scope: ${disp}`, { line: at.line, col: at.col, hint });
  }

  checkCon(name, at, inPattern) {
    if (ALLOWED_CONS.has(name) || name === ':' || name === '[]') return;
    const lower = name[0].toLowerCase() + name.slice(1);
    const hint = name === 'Null' || name === 'Nil'
      ? 'Prázdný seznam se píše [].'
      : MAYBE_CONS.has(name)
        ? `Typy Maybe a Either (${name}) tenhle trenažér nepodporuje. V testu stačí čísla, Bool, znaky, seznamy a n-tice.`
        : `Jména začínající velkým písmenem jsou konstruktory (True, False). Názvy funkcí a proměnných musí začínat malým písmenem, např. ${lower}.`;
    throw new HsError('scope', inPattern ? `Not in scope: data constructor ‘${name}’` : `Data constructor not in scope: ${name}`, { line: at.line, col: at.col, hint });
  }

  checkPatCons(p) {
    switch (p.t) {
      case 'pcon': this.checkCon(p.name, p, true); for (const a of p.args) this.checkPatCons(a); break;
      case 'plist': case 'ptuple': for (const a of p.items) this.checkPatCons(a); break;
      case 'pas': this.checkPatCons(p.pat); break;
      default: break;
    }
  }

  binderSet(pats) {
    const set = new Set();
    for (const p of pats) {
      this.checkPatCons(p);
      for (const b of patBinders(p)) {
        if (set.has(b.name)) {
          throw new HsError('scope', `Conflicting definitions for ‘${b.name}’`, {
            line: b.line, col: b.col,
            hint: `Proměnná ${b.name} je ve vzorech dvakrát. Každý argument musí mít jiné jméno; rovnost dvou argumentů ověř stráží (| a == b = …).`,
          });
        }
        set.add(b.name);
      }
    }
    return set;
  }

  withScope(names, fn) {
    this.stack.push({ names, group: null });
    try { return fn(); } finally { this.stack.pop(); }
  }

  // ---------- výrazy ----------
  expr(e) {
    switch (e.t) {
      case 'var':
        if (e.tupleCon) return;
        if (e.name === '_') {
          throw new HsError('scope', 'Found hole: _', { line: e.line, col: e.col, hint: 'Podtržítko _ se smí použít jen ve vzoru (v argumentech), ne ve výrazu na pravé straně.' });
        }
        e.ref = this.lookup(e.name, e) || this.notInScope(e.name, e);
        return;
      case 'con': this.checkCon(e.name, e, false); return;
      case 'lit': return;
      case 'app': this.expr(e.f); this.expr(e.a); return;
      case 'binop':
        e.op.ref = this.lookup(e.op.name, e.op) || this.notInScope(e.op.name, e.op);
        this.expr(e.l); this.expr(e.r); return;
      case 'sectionL': case 'sectionR':
        e.op.ref = this.lookup(e.op.name, e.op) || this.notInScope(e.op.name, e.op);
        this.expr(e.e); return;
      case 'neg': case 'paren': case 'ann': this.expr(e.e); return;
      case 'lam': {
        const names = this.binderSet(e.pats);
        this.withScope(names, () => this.expr(e.body));
        return;
      }
      case 'let': this.group(e.decls, false, () => this.expr(e.body)); return;
      case 'if': this.expr(e.c); this.expr(e.th); this.expr(e.el); return;
      case 'case':
        this.expr(e.scrut);
        for (const a of e.alts) {
          const names = this.binderSet([a.pat]);
          this.withScope(names, () => this.rhsWithWhere(a.rhs, a.where));
        }
        return;
      case 'tuple': case 'list': for (const x of e.items) this.expr(x); return;
      case 'range': this.expr(e.from); if (e.then) this.expr(e.then); if (e.to) this.expr(e.to); return;
      case 'comp': {
        const depth = this.stack.length;
        try {
          for (const q of e.quals) {
            if (q.t === 'qgen') { this.expr(q.e); this.stack.push({ names: this.binderSet([q.pat]), group: null }); }
            else if (q.t === 'qguard') this.expr(q.e);
            else this.group(q.decls, false, null, true);
          }
          this.expr(e.e);
        } finally { this.stack.length = depth; }
        return;
      }
      default: throw new Error('scope: neznámý uzel ' + e.t);
    }
  }

  rhs(r) {
    if (r.t === 'plain') this.expr(r.body);
    else for (const g of r.guards) { this.expr(g.cond); this.expr(g.body); }
  }
  rhsWithWhere(r, where) {
    if (where) this.group(where, false, () => this.rhs(r));
    else this.rhs(r);
  }

  // Skupina vazeb (top-level, let, where). keepPushed: scope zůstane (pro let v generátoru).
  group(decls, isModule, inner, keepPushed) {
    const binds = decls.filter((d) => d.t === 'fun' || d.t === 'pbind');
    const names = new Set();
    const nameToKey = new Map();
    const deps = new Map();
    const firstAt = new Map();
    binds.forEach((b, i) => {
      b.key = i;
      deps.set(i, new Set());
      const ns = b.t === 'fun' ? [{ name: b.name, line: b.line, col: b.col }] : patBinders(b.pat);
      if (b.t === 'pbind') this.checkPatCons(b.pat);
      for (const n of ns) {
        if (names.has(n.name)) {
          const f = firstAt.get(n.name);
          throw new HsError('scope', `Multiple declarations of ‘${n.name}’`, {
            line: n.line, col: n.col, hint: `Jméno ${n.name} je definované víckrát (poprvé na řádku ${f.line}). Klauzule jedné funkce musí být hned pod sebou.`,
          });
        }
        names.add(n.name); nameToKey.set(n.name, i); firstAt.set(n.name, n);
      }
      if (b.t === 'fun') {
        const ar = b.clauses[0].pats.length;
        for (const c of b.clauses) {
          if (c.pats.length !== ar) {
            throw new HsError('scope', `Equations for ‘${b.name}’ have different numbers of arguments`, {
              line: c.line, col: c.col, hint: `Všechny řádky funkce ${b.name} musí mít stejný počet argumentů.`,
            });
          }
        }
        if (ar === 0 && b.clauses.length > 1) {
          const c = b.clauses[1];
          throw new HsError('scope', `Multiple declarations of ‘${b.name}’`, { line: c.line, col: c.col, hint: `${b.name} je definované víckrát.` });
        }
      }
    });
    const sigNames = new Set();
    for (const d of decls) {
      if (d.t !== 'sig') continue;
      for (const n of d.names) {
        if (sigNames.has(n)) throw new HsError('scope', `Duplicate type signatures for ‘${n}’`, { line: d.line, col: d.col, hint: `Funkce ${n} má dvě typové signatury.` });
        sigNames.add(n);
        if (!names.has(n)) {
          throw new HsError('scope', `The type signature for ‘${n}’ lacks an accompanying binding`, {
            line: d.line, col: d.col, hint: `Je tu typ funkce ${n}, ale chybí její definice (nebo je jméno napsané jinak).`,
          });
        }
      }
    }
    const grp = { nameToKey, deps, current: null };
    this.stack.push({ names, group: grp, isModule });
    try {
      for (const b of binds) {
        grp.current = b.key;
        if (b.t === 'fun') {
          for (const c of b.clauses) {
            const ns = this.binderSet(c.pats);
            this.withScope(ns, () => this.rhsWithWhere(c.rhs, c.where));
          }
        } else {
          this.rhsWithWhere(b.rhs, b.where);
        }
      }
      grp.current = null;
      for (const b of binds) b.deps = deps.get(b.key);
      if (inner) inner();
    } finally {
      if (!keepPushed) this.stack.pop();
    }
    return names;
  }
}
