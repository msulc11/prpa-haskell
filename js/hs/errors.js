// Chyby enginu. Všechny vnitřní chyby se hází jako HsError a ven jdou jako prostý objekt.

export class HsError extends Error {
  constructor(kind, message, opts = {}) {
    super(message);
    this.kind = kind;          // 'parse' | 'scope' | 'type' | 'runtime' | 'timeout' | 'stack'
    this.hsMessage = message;
    this.hint = opts.hint || '';
    this.line = opts.line;
    this.col = opts.col;
    this.partial = opts.partial;
  }
}

export function errAt(kind, message, at, hint) {
  return new HsError(kind, message, { line: at && at.line, col: at && at.col, hint });
}

const RUNTIME_HINTS = [
  [/Prelude\.(head|tail|last|init): empty list/, (m) => `Funkce ${m[1]} dostala prázdný seznam []. Ošetři prázdný seznam zvláštním vzorem, např. f [] = …`],
  [/Prelude\.(maximum|minimum|foldr1|foldl1|cycle): empty list/, (m) => `Funkce ${m[1]} nejde použít na prázdný seznam [].`],
  [/Prelude\.undefined/, () => 'Vyhodnotila se hodnota undefined.'],
  [/Non-exhaustive guards/, () => 'Žádná stráž neplatí. Chybí větev otherwise?'],
];

export function toPlain(e, where) {
  if (e instanceof HsError) {
    let hint = e.hint || '';
    if (!hint && e.kind === 'runtime') {
      for (const [re, f] of RUNTIME_HINTS) { const m = e.hsMessage.match(re); if (m) { hint = f(m); break; } }
    }
    const out = { kind: e.kind, message: e.hsMessage, hint };
    if (e.line != null) out.line = e.line;
    if (e.col != null) out.col = e.col;
    if (where) out.where = where;
    if (e.partial != null) out.partial = e.partial;
    return out;
  }
  if (e instanceof RangeError || (e && /call stack/i.test(String(e.message)))) {
    return {
      kind: 'stack',
      message: 'stack overflow',
      hint: 'Rekurze je moc hluboká nebo se nezastaví. Chybí koncová podmínka (např. f 0 = … nebo f [] = …), nebo se argument v rekurzivním volání nezmenšuje?',
      where,
    };
  }
  return { kind: 'runtime', message: 'Interní chyba: ' + (e && e.message ? e.message : String(e)), hint: '', where };
}
