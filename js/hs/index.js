// Veřejné API enginu (viz docs/CONTRACT.md, sekce 1).

import { tokenize } from './lexer.js';
import { Parser, DEFAULT_FIXITY } from './parser.js';
import { Scoper } from './scope.js';
import { TC, showScheme, showType } from './types.js';
import { compileDecls, compileExpr } from './compile.js';
import { state, Out, TRUNC, showTypedG, run } from './runtime.js';
import { PRIMS, PRELUDE_SRC, HIDDEN, primFn } from './prelude.js';
import { HsError, toPlain } from './errors.js';

import { PRELUDE_REF } from './exprtools.js';

export { tokenize };
export { exprTree, parenthesize, evalSteps, sameStructure } from './exprtools.js';

let PRELUDE = null;

export function getPrelude() {
  if (PRELUDE) return PRELUDE;
  const tc = new TC({ mr: true });
  const tyRoot = Object.create(null);
  const valRoot = Object.create(null);
  const primNames = new Set();
  for (const [name, sig, arity, impl] of PRIMS) {
    tyRoot[name] = tc.convertSig(new Parser(sig).parseSigType(), 'generic', 0);
    valRoot[name] = primFn(name, arity, impl);
    primNames.add(name);
  }
  const parser = new Parser(PRELUDE_SRC);
  const decls = parser.parseModule();
  const scoper = new Scoper({
    lookupGlobal: (n) => (primNames.has(n) ? 'prelude' : null),
    preludeHas: () => false,
    allNames: () => primNames,
  });
  const srcNames = scoper.group(decls, true);
  const tyEnv = tc.inferGroup(decls, tyRoot, 0);
  tc.defaultAmbiguous(-1);
  const valEnv = Object.create(valRoot);
  compileDecls(decls)(valEnv);
  const names = new Set([...primNames, ...srcNames].filter((n) => !HIDDEN.has(n)));
  PRELUDE = { tyEnv, valEnv, names, fixities: parser.fix };
  return PRELUDE;
}
PRELUDE_REF.getPrelude = getPrelude;

const HELP = `Příkazy konzole:
  výraz          vyhodnotí výraz, např. fce3 2 5
  :t výraz       typ výrazu, např. :t map
  :r             znovu načte soubor
  let x = 5      definice v konzoli (stačí i x = 5)`;

export class Session {
  constructor() {
    this.P = getPrelude();
    this.mod = null;
    this.repl = [];
    this.source = null;
  }

  get fixities() { return this.mod ? this.mod.fixities : this.P.fixities; }
  get tyEnv() { return this.repl.length ? this.repl[this.repl.length - 1].tyEnv : this.mod ? this.mod.tyEnv : this.P.tyEnv; }
  get valEnv() { return this.repl.length ? this.repl[this.repl.length - 1].valEnv : this.mod ? this.mod.valEnv : this.P.valEnv; }

  load(source) {
    this.source = source;
    this.mod = null;
    this.repl = [];
    try {
      const P = this.P;
      const parser = new Parser(source, { fixities: P.fixities });
      const decls = parser.parseModule();
      const scoper = new Scoper({
        lookupGlobal: (n) => (P.names.has(n) ? 'prelude' : null),
        preludeHas: (n) => P.names.has(n),
        allNames: () => P.names,
      });
      const names = scoper.group(decls, true);
      const tc = new TC({ mr: true });
      const tyEnv = tc.inferGroup(decls, P.tyEnv, 0);
      tc.defaultAmbiguous(-1);
      const valEnv = Object.create(P.valEnv);
      compileDecls(decls)(valEnv);
      this.mod = { decls, names, tyEnv, valEnv, fixities: parser.fix };
      return { ok: true, names: [...names] };
    } catch (e) {
      return { ok: false, error: toPlain(e, 'module') };
    }
  }

  scoperForExpr() {
    const P = this.P, mod = this.mod, repl = this.repl;
    const allNames = () => {
      const s = new Set(P.names);
      if (mod) for (const n of mod.names) s.add(n);
      for (const l of repl) for (const n of l.names) s.add(n);
      return s;
    };
    return new Scoper({
      lookupGlobal: (n) => {
        for (let i = repl.length - 1; i >= 0; i--) if (repl[i].names.has(n)) return 'repl';
        if (mod && mod.names.has(n)) return P.names.has(n) ? 'ambiguous' : 'module';
        return P.names.has(n) ? 'prelude' : null;
      },
      preludeHas: (n) => P.names.has(n),
      allNames,
    });
  }

  prepareExpr(src) {
    const parser = new Parser(src, { fixities: this.fixities });
    const e = parser.parseExprOnly();
    this.scoperForExpr().expr(e);
    return e;
  }

  eval(src, opts = {}) {
    const fuel = opts.fuel ?? 2_000_000;
    const maxOutput = opts.maxOutput ?? 4000;
    let out = null;
    try {
      const e = this.prepareExpr(src);
      const tc = new TC();
      const t = tc.infer(e, this.tyEnv, 1);
      tc.entail('Show', t, { text: 'a use of ‘print’', line: e.line, col: e.col });
      tc.defaultAmbiguous(0);
      const code = compileExpr(e, true);
      state.steps = 0;
      state.fuel = fuel;
      out = new Out(maxOutput);
      let truncated = false;
      try {
        const v = run(code(this.valEnv));
        run(showTypedG(v, t, out));
      } catch (x) {
        if (x === TRUNC) truncated = true;
        else throw x;
      }
      return { ok: true, output: out.toString(), type: showType(t), truncated };
    } catch (err) {
      const pe = toPlain(err, 'expr');
      if (out && out.len > 0 && (pe.kind === 'runtime' || pe.kind === 'timeout' || pe.kind === 'stack')) pe.partial = out.toString();
      return { ok: false, error: pe };
    } finally {
      state.fuel = Infinity;
    }
  }

  typeOf(src) {
    try {
      const e = this.prepareExpr(src);
      const tc = new TC();
      const t = tc.infer(e, this.tyEnv, 1);
      tc.generalize(t, 0);
      tc.defaultAmbiguous(0);
      return { ok: true, type: showScheme(t) };
    } catch (err) {
      return { ok: false, error: toPlain(err, 'expr') };
    }
  }

  define(src) {
    try {
      const parser = new Parser(src, { fixities: this.fixities });
      const decls = parser.parseModule();
      const scoper = this.scoperForExpr();
      const names = scoper.group(decls, false);
      const tc = new TC();
      const tyEnv = tc.inferGroup(decls, this.tyEnv, 0);
      tc.defaultAmbiguous(-1);
      const valEnv = Object.create(this.valEnv);
      compileDecls(decls)(valEnv);
      this.repl.push({ names, tyEnv, valEnv });
      return { ok: true, output: '' };
    } catch (err) {
      return { ok: false, error: toPlain(err, 'expr') };
    }
  }

  command(line) {
    const s = String(line).trim();
    if (!s) return { ok: true, output: '' };
    if (s.startsWith(':')) {
      const m = s.match(/^:([a-zA-Z?]+)\s*([\s\S]*)$/);
      const cmd = m ? m[1] : '';
      const arg = m ? m[2].trim() : '';
      if (cmd === 't' || cmd === 'type') {
        if (!arg) return { ok: false, error: { kind: 'parse', message: 'syntax: :type <expr>', hint: 'Napiš :t a za to výraz, např. :t map.', where: 'expr' } };
        const r = this.typeOf(arg);
        return r.ok ? { ok: true, output: `${arg} :: ${r.type}` } : r;
      }
      if (cmd === 'i' || cmd === 'info') {
        const r = this.typeOf(arg);
        return r.ok ? { ok: true, output: `${arg} :: ${r.type}` } : r;
      }
      if (cmd === 'r' || cmd === 'reload') {
        if (this.source == null) return { ok: true, output: 'Ok, no modules loaded.' };
        const r = this.load(this.source);
        return r.ok ? { ok: true, output: 'Ok, one module loaded.' } : { ok: false, error: r.error };
      }
      if (cmd === 'l' || cmd === 'load') {
        return { ok: false, error: { kind: 'parse', message: ':load needs a file', hint: 'Soubor se do konzole načítá tlačítkem Načíst; :r ho načte znovu.', where: 'expr' } };
      }
      if (cmd === '?' || cmd === 'h' || cmd === 'help') return { ok: true, output: HELP };
      if (cmd === 'q' || cmd === 'quit') return { ok: true, output: 'Leaving GHCi.' };
      if (cmd === 'm' || cmd === 'module') return { ok: true, output: '' };
      return { ok: false, error: { kind: 'parse', message: `unknown command ‘:${cmd}’`, hint: 'Podporované příkazy: :t výraz, :r, :?', where: 'expr' } };
    }
    if (/^import\s/.test(s)) return { ok: true, output: '' };
    // výraz, nebo definice?
    let exprErr = null;
    try {
      new Parser(s, { fixities: this.fixities }).parseExprOnly();
    } catch (e) {
      if (!(e instanceof HsError)) return { ok: false, error: toPlain(e, 'expr') };
      exprErr = e;
    }
    if (!exprErr) {
      const r = this.eval(s);
      return r.ok ? { ok: true, output: r.output + (r.truncated ? '…' : '') } : r;
    }
    const defSrc = /^let\s/.test(s) ? s.slice(4) : s;
    let looksDef = false;
    try {
      const decls = new Parser(defSrc, { fixities: this.fixities }).parseModule();
      looksDef = decls.some((d) => d.t === 'fun' || d.t === 'pbind' || d.t === 'sig');
    } catch (e) {
      looksDef = false;
    }
    if (looksDef) return this.define(defSrc);
    return { ok: false, error: toPlain(exprErr, 'expr') };
  }
}
