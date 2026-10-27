# PRPA Haskell trenér – kontrakty mezi částmi

Statický web (GitHub Pages), čisté ES moduly bez bundleru, žádné závislosti z npm.
`package.json` má `"type": "module"`, takže testy jdou spustit `node tests/xyz.test.js`.

```
web/
  index.html, css/            UI (později)
  js/hs/                      ENGINE – interpret podmnožiny Haskellu (vlastník: engine agent)
  js/data/                    OBSAH – úlohy, generátory, tahák (vlastník: content agent)
  js/ui/                      UI (později)
  tests/                      testy (engine-*.test.js, content-*.test.js, tools/)
```

Lokální GHC (pro ověřování, ne pro web):
`C:/Users/matej/ghc-9.12.4-x86_64-unknown-mingw32-int_native/ghc-9.12.4-x86_64-unknown-mingw32/bin/` (ghc, ghci, runghc).

---

## 1. ENGINE API – `js/hs/index.js`

```js
import { Session, tokenize, exprTree, parenthesize, evalSteps, sameStructure } from './js/hs/index.js'

const s = new Session()            // Prelude už je načtená
s.load(source)                     // jako :l v GHCi – nahradí uživatelský modul
  // -> { ok: true, names: ['fce3', ...] }
  // -> { ok: false, error: HsError }   (modul pak není načtený, jako GHCi)
s.eval(exprSrc, { fuel = 2_000_000, maxOutput = 4000 } = {})
  // -> { ok: true, output: '[2,2,6]', type: '[Integer]', truncated: false }
  // -> { ok: false, error: HsError }
s.typeOf(exprSrc)                  // -> { ok: true, type: '(Ord a, Num a) => a -> a -> a' } | { ok:false, error }
s.command(line)                    // pohodlí pro REPL: ':t e', ':type e', ':r', 'let x = 5', 'x = 5', jinak eval
  // -> { ok: true, output: string } | { ok: false, error: HsError }

HsError = {
  kind: 'parse' | 'scope' | 'type' | 'runtime' | 'timeout' | 'stack',
  message: string,   // krátce ve stylu GHC (anglicky), např. "No instance for (Num Bool) arising from a use of ‘*’"
  hint: string,      // česky, srozumitelně pro studenta, může být ''
  line?: number,     // 1-based, v rámci zdroje, kterého se chyba týká
  col?: number,      // 1-based
  where?: 'module' | 'expr'
}
```

`output` je přesně to, co by vypsalo GHCi (`show` výsledku; řetězce v uvozovkách, Double jako `2.0`, `1.0e-2`, záporná čísla v seznamu `[-1,-2]`, n-tice `(1,True)`).
Testy úloh porovnávají `s.eval(test.expr).output === test.expected` (řetězcově).

### Pomocné funkce pro úlohu 1 (výrazy)

```js
tokenize(src)       // bezztrátové tokeny pro zvýraznění syntaxe a „klikací“ tokeny:
                    // [{ type: 'id'|'con'|'kw'|'op'|'num'|'char'|'str'|'punct'|'comment'|'ws'|'nl'|'err',
                    //    text, start, end, line, col }]
                    // tokens.map(t => t.text).join('') === src  (vždy, i pro nevalidní vstup)
exprTree(src)       // -> { ok: true, tree } | { ok: false, error }
                    // uzel (bez závorkových uzlů – závorky jen ovlivní strukturu; každý uzel má start/end v src):
                    //  { kind: 'op',  op: '+', opStart, opEnd, left, right, start, end }        // i `div` => op: 'div'
                    //  { kind: 'app', fn: Node, args: [Node], headStart, headEnd, start, end }  // f x y, (*) 3 (2+4), (+2) 5
                    //  { kind: 'neg', arg, opStart, opEnd, start, end }                          // unární minus
                    //  { kind: 'section', op, side: 'left'|'right', arg, start, end }            // (2+), (+2), (`div` 2)
                    //  { kind: 'opfn', op, start, end }                                          // (+)
                    //  { kind: 'lit', text, start, end } | { kind: 'var', name, start, end }
                    //  { kind: 'other', start, end }                                             // if/let/lambda/seznam… jako celek
parenthesize(src)   // plně uzávorkovaný zápis, vnější úroveň bez závorek:
                    // '1 + 2 ^ 3 * 4' -> '1 + ((2 ^ 3) * 4)';  '3 * 2 < 4' -> '(3 * 2) < 4'
                    // '(*) 3 (2 + 4)' -> '(*) 3 (2 + 4)';  '2 ^ 3 ^ 2' -> '2 ^ (3 ^ 2)'
evalSteps(src)      // -> { ok: true, steps: ['1 + 2 ^ 3 * 4', '1 + 8 * 4', '1 + 32', '33'], value: '33' }
                    // každý krok zredukuje jeden nejvnitřnější redex (nejlevější), zápis s minimem závorek
sameStructure(a, b) // true, pokud a i b dají stejný strom (závorky navíc nevadí): kontrola uživatelova uzávorkování
```

## 2. OBSAH – `js/data/*.js`

Všechny texty česky. `expected` = přesný výstup GHCi (ověřený skutečným GHC).

```js
// js/data/uloha1.js – vyhodnocení výrazu + doplnění závorek (2 body)
export const fixed = [
  { id: 'u1-v1', expr: '1 + 2 ^ 3 * 4', source: 'Písemka, varianta 1', value: '33', parens: '1 + ((2 ^ 3) * 4)' },
  ...
]
export function generate(rng) // rng: () => číslo v [0,1); vrací { id: 'gen-…', expr, level: 1|2|3 }
                               // value/parens dopočítá engine za běhu

// js/data/uloha2.js – najdi a oprav jednu chybu (2 body)
export const bugs = [{
  id: 'u2-fch1',
  source: 'Písemka, varianta 1' | null,
  name: 'fch1',
  code: 'fch1 a = if 2 * a < 100 then 1 else [0]',
  spots: [ { text: '[0]', nth: 0 }, { text: '1', nth: 1 } ],   // kde je chyba (podřetězec + kolikátý výskyt, od 0); stačí trefit jeden
  kind: 'type' | 'syntax' | 'scope',
  ghcError: 'No instance for (Num [a]) arising from the literal ‘1’',  // zkrácená reálná hláška GHC
  question: 'V čem je chyba?',
  options: ['…', '…', '…', '…'], correct: 2,                     // vysvětlení (jedno správné)
  explanation: '…',                                              // proč, 1–3 věty
  fixes: ['fch1 a = if 2 * a < 100 then [1] else [0]', 'fch1 a = if 2 * a < 100 then 1 else 0'],
  tests: [ { expr: 'fch1 10', expected: '…' } ] | []             // jen když všechny opravy dávají stejné výsledky
}]

// js/data/uloha3.js – funkce s podmínkami (3 body), js/data/uloha4.js – seznamy (3 body)
export const tasks = [{
  id: 'u3-fce3',
  source: 'Písemka, varianta 1' | null,
  name: 'fce3',
  signature: 'fce3 x y',
  text: 'Napište funkci fce3 x y …',                // zadání ve stylu písemky
  topic: 'podmínky' | 'stráže' | 'vzory' | 'rekurze' | 'seznamy' | 'generátor seznamu',
  tests: [ { expr: 'fce3 2 5', expected: '10' }, … ],   // 4–8 testů vč. hraničních případů
  solutions: [ { label: 'if-then-else', code: '…' }, { label: 'stráže', code: '…' } ],
  hints: ['…', '…']                                // postupné nápovědy, poslední skoro řešení
}]
export function generate(rng) // nová varianta stejného tvaru jako v písemce;
                               // tests: [{ expr, expected: null }] – expected dopočítá engine ze solutions[0]

// js/data/teorie.js – tahák ze zápisků
export const sections = [{ id, title, blocks: [
  { type: 'p', text },                       // povolené jen `inline kód` v backtickách
  { type: 'code', code, run: true|false },   // run: lze poslat do konzole
  { type: 'table', head: [...], rows: [[...]] }
]}]

// js/data/prpa.js – výchozí obsah konzole = funkce ze zápisků (prpa.hs), validní pro engine i GHC
export const prpaSource = `...`
```
