// Testy enginu: node tests/engine.test.js
// (porovnání se skutečným GHC: node tests/tools/engine-vs-ghc.mjs)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Session, tokenize, exprTree, parenthesize, evalSteps, sameStructure } from '../js/hs/index.js';

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(`✗ ${name}\n    ${e.message}`); }
}
function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} očekáváno ${b}, je ${a}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'podmínka neplatí'); }

const s = new Session();
const ev = (e) => { const r = s.eval(e); return r.ok ? r.output : `!${r.error.kind}`; };

// ---------- tokenize ----------
test('tokenize je bezztrátový', () => {
  const inputs = [
    'f x = x + 1', "f' (x:xs) = 'a' : \"b\\\"c\" -- komentář\n  {- {- vnořený -} -} ++ xs",
    'g x\n  | x > 0 = 1\n  | otherwise = 0\r\n', 'h = [1..10] ++ [x | x <- [1,3..], even x]', '"neukončený',
    "'ab' @@ § ` \t\t x", '0x1F 1.5e-3 1e10 2.', 'a `div` b', '', 'délka (_:xs) = 1 + délka xs',
  ];
  for (const src of inputs) eq(tokenize(src).map((t) => t.text).join(''), src, JSON.stringify(src));
});
test('tokenize typy tokenů', () => {
  const t = tokenize("f x = if x then 'a' else \"b\" -- c").filter((x) => x.type !== 'ws');
  eq(t.map((x) => x.type), ['id', 'id', 'op', 'kw', 'id', 'kw', 'char', 'kw', 'str', 'comment']);
  eq(tokenize('x\n  y')[3].line, 2);
  eq(tokenize('x\n  y')[3].col, 3);
});

// ---------- vyhodnocení ----------
const EVAL = [
  ['1 + 2 ^ 3 * 4', '33'], ['3 * 2 < 4', 'False'], ['(*) 3 (2 + 4)', '18'], ['2^3^2', '512'], ['(2^3)^2', '64'], ['1-2-3', '-4'], ['1-(2-3)', '2'],
  ['sqrt (3^2 + 4^2)', '5.0'], ['7 / 2', '3.5'], ['7 `div` 2', '3'], ['(-7) `div` 2', '-4'], ['(-7) `mod` 2', '1'], ['(-7) `rem` 2', '-1'],
  ['- 2 ^ 2', '-4'], ['max 2 3 * 4', '12'], ['(+2) 5', '7'], ['(2-) 5', '-3'], ['(subtract 2) 5', '3'], ['(`div` 2) 9', '4'],
  ['map (*2) [1,2,3]', '[2,4,6]'], ['filter odd [1..10]', '[1,3,5,7,9]'], ['take 3 [1..]', '[1,2,3]'], ['[x*x | x <- [1..5], odd x]', '[1,9,25]'],
  ['[(a,b) | a <- [1,2], b <- "xy"]', '[(1,\'x\'),(1,\'y\'),(2,\'x\'),(2,\'y\')]'], ['"ab" ++ "cd"', '"abcd"'], ['words "a  b"', '["a","b"]'],
  ['length [1..100000]', '100000'], ['sum [1..10000]', '50005000'], ['product [1..25]', '15511210043330985984000000'],
  ['0.1 + 0.2', '0.30000000000000004'], ['1.0e-2', '1.0e-2'], ['12345678.9', '1.23456789e7'], ['fromIntegral (length [1,2,3]) / 2', '1.5'],
  ['round 2.5', '2'], ['round 3.5', '4'], ['[0.1,0.2..0.5]', '[0.1,0.2,0.30000000000000004,0.4,0.5]'], ['show "č\\n"', '"\\"\\\\269\\\\n\\""'],
  ["['a'..'e']", '"abcde"'], ['[10,8..1]', '[10,8,6,4,2]'], ['zip [1,2] "ab"', "[(1,'a'),(2,'b')]"], ['let (a, b) = (1, 2) in a + b', '3'],
  ['case [1,2] of { [] -> 0; (x:_) -> x }', '1'], ['if 1 > 2 then "a" else "b"', '"b"'], ['(\\x y -> x * y) 3 4', '12'],
  ['let f 0 = 1; f n = n * f (n - 1) in f 20', '2432902008176640000'], ['iterate (*2) 1 !! 10', '1024'], ['[1,2] == [1,2]', 'True'],
  ['"abc" < "abd"', 'True'], ['(1, \'a\') < (1, \'b\')', 'True'], ['maximum "hello"', "'o'"], ['reverse [1,2,3]', '[3,2,1]'],
  ['head []', '!runtime'], ['1 `div` 0', '!runtime'], ['\\x -> x', '!type'], ['True + 1', '!type'], ['1 == 2 == 3', '!parse'],
  ['2 * -3', '!parse'], ['foo 1', '!scope'], ['length [1..]', '!timeout'], ['let f x = f x in f 1', '!timeout'],
];
for (const [e, want] of EVAL) test(`eval ${e}`, () => eq(ev(e), want));

test('nekonečný seznam se ořízne', () => {
  const r = s.eval('[1..]', { maxOutput: 100 });
  ok(r.ok && r.truncated && r.output.length === 100, JSON.stringify(r));
});
test('typ výsledku', () => {
  eq(s.eval('[1,2]').type, '[Integer]');
  eq(s.eval('sqrt 2').type, 'Double');
  eq(s.eval('"a"').type, 'String');
});

// ---------- modul ----------
const prpa = readFileSync(join(here, '..', '..', 'prpa.hs'), 'utf8');
test('prpa.hs se načte a funguje', () => {
  const r = s.load(prpa);
  ok(r.ok, JSON.stringify(r.error));
  ok(r.names.includes('faktorial') && r.names.includes('zvys'), 'chybí jména');
  eq(ev('faktorial 10'), '3628800');
  eq(ev('nsd 12 18'), '6');
  eq(ev('smazVsechny 2 [1,2,3,2]'), '[1,3]');
  eq(ev('zvysO2 5'), '7');
  eq(ev('aplikujBinarniFunkci 1 2 (+)'), '3');
  eq(ev('delka [1..10000]'), '10000');
  eq(ev('nty 5 [1]'), '!runtime');
  eq(ev("faktorial'' (-1)"), '!runtime');
  eq(ev('faktorial (-1)'), '!stack');
  eq(ev('signum 5'), '!scope');
  eq(ev("signum' (-5)"), '-1');
});
test('rychlost: načtení prpa.hs + výraz < 50 ms', () => {
  const t0 = performance.now();
  const s2 = new Session();
  s2.load(prpa);
  s2.eval('faktorial 20');
  s2.eval('smazVsechny 2 [1,2,3,2,5,2]');
  const ms = performance.now() - t0;
  ok(ms < 50, `trvalo ${ms.toFixed(1)} ms`);
});

const SOL = `fce3 x y = if x < y then x * y else x - y
nejvetsi3 a b c
  | a >= b && a >= c = a
  | b >= c = b
  | otherwise = c
fce4 x y
  | x < 0 = 2 * y
  | x == 0 = 3 * y
  | otherwise = 4 * y
zdvojLiche :: [Int] -> [Int]
zdvojLiche [] = []
zdvojLiche (x:xs)
  | odd x = 2 * x : zdvojLiche xs
  | otherwise = x : zdvojLiche xs
ztrojSude xs = [if even x then 3 * x else x | x <- xs]
zapornaPosloupnost a
  | a > 0 = zp 1
  | otherwise = []
  where zp k | k > a = []
             | otherwise = (-k) : zp (k + 1)
zapornaPosloupnost2 a = [-x | x <- [1..a]]
`;
test('typická řešení úloh', () => {
  const r = s.load(SOL);
  ok(r.ok, JSON.stringify(r.error));
  eq(ev('fce3 2 5'), '10'); eq(ev('fce3 5 2'), '3');
  eq(ev('nejvetsi3 1 7 3'), '7');
  eq(ev('fce4 (-1) 5'), '10'); eq(ev('fce4 0 5'), '15'); eq(ev('fce4 3 5'), '20');
  eq(ev('zdvojLiche [1,2,3]'), '[2,2,6]'); eq(ev('ztrojSude [1,2,3,4]'), '[1,6,3,12]');
  eq(ev('zapornaPosloupnost 4'), '[-1,-2,-3,-4]'); eq(ev('zapornaPosloupnost 0'), '[]'); eq(ev('zapornaPosloupnost2 3'), '[-1,-2,-3]');
  eq(s.typeOf('fce3').type, '(Ord a, Num a) => a -> a -> a');
  eq(s.typeOf('ztrojSude').type, 'Integral a => [a] -> [a]');
  eq(s.typeOf('zdvojLiche').type, '[Int] -> [Int]');
  eq(s.typeOf('map').type, '(a -> b) -> [a] -> [b]');
});

// ---------- chyby ----------
const BUGS = [
  ['fch1 a = if 2 * a < 100 then 1 else [0]', 'type', /Num \[a0\]/],
  ['fch2 a = if a * 10 then a < 10 else a > 10', 'type', /No instance for ‘Num Bool’ arising from a use of ‘\*’/],
  ['fch4 a b = if a = b then a else a - b', 'parse', /parse error on input ‘=’/],
  ['f x = if x > 0 then 1', 'parse', /parse error/],
  ['g x = x != 2', 'scope', /Variable not in scope: \(!=\)/],
  ['Fch a = 1', 'scope', /data constructor ‘Fch’/],
  ['f :: a -> a\nf x = x + 1', 'type', /No instance for ‘Num a’/],
  ['h xs = length xs / 2', 'type', /Fractional Int/],
  ['f x:xs = x', 'parse', /Parse error in pattern/],
  ['z (x:xs) = x : x', 'type', /Occurs check/],
  ['signum a = 1\nw = signum 3', 'scope', /Ambiguous occurrence ‘signum’/],
  ['f x\n| x > 0 = 1', 'parse', /parse error/],
  ['f x = (x + 1', 'parse', /parse error/],
  ['f [] = 0\nf (x:xs) = 1\ng = 1\nf 3 = 2', 'scope', /Multiple declarations/],
  ['f x x = 1', 'scope', /Conflicting definitions/],
  ['f :: Int -> Int\nf x y = x', 'type', /has 2 arguments/],
  ['f x = if x > 0 then True else "ne"', 'type', /Couldn't match expected type ‘Bool’ with actual type ‘String’/],
  ['f x | x > 0 -> 1', 'parse', /->/],
  ["f x = 'ab'", 'parse', /lexical error/],
  ['f a = a / 2 + a `div` 2\nw = f 3', 'type', /Ambiguous type variable/],
  ['data X = A | B', 'parse', /not supported/],
];
for (const [src, kind, re] of BUGS) {
  test(`chyba: ${src.split('\n')[0]}`, () => {
    const r = s.load(src);
    ok(!r.ok, 'načetlo se bez chyby');
    eq(r.error.kind, kind, r.error.message);
    ok(re.test(r.error.message), `zpráva: ${r.error.message}`);
    ok(r.error.hint && r.error.hint.length > 5, `chybí hint pro ${r.error.message}`);
    ok(r.error.line >= 1 && r.error.col >= 1, 'chybí pozice');
    eq(r.error.where, 'module');
  });
}
test('po chybě není modul načtený', () => {
  s.load('ahoj = 1');
  eq(ev('ahoj'), '1');
  s.load('ahoj = ');
  eq(ev('ahoj'), '!scope');
});

// ---------- konzole ----------
test('command: :t, let, definice, :r, import', () => {
  const c = new Session();
  c.load('dvakrat x = 2 * x');
  eq(c.command(':t dvakrat').output, 'dvakrat :: Num a => a -> a');
  eq(c.command(':type map').output, 'map :: (a -> b) -> [a] -> [b]');
  eq(c.command('let x = 5').ok, true);
  eq(c.command('x * 2').output, '10');
  eq(c.command('y = x + 1').ok, true);
  eq(c.command('y').output, '6');
  eq(c.command('f 0 = 1; f n = n * f (n - 1)').ok, true);
  eq(c.command('f 5').output, '120');
  eq(c.command('dvakrat 21').output, '42');
  eq(c.command('import Data.Char').ok, true);
  eq(c.command('toUpper \'a\'').output, "'A'");
  eq(c.command(':r').output, 'Ok, one module loaded.');
  eq(c.command('x').ok, false);
  eq(c.command('').output, '');
  eq(c.command(':xyz').ok, false);
  eq(c.command('let a = 1 in a + 1').output, '2');
  eq(c.command('[1..]').output.endsWith('…'), true);
});

// ---------- úloha 1 ----------
test('parenthesize', () => {
  eq(parenthesize('1 + 2 ^ 3 * 4'), '1 + ((2 ^ 3) * 4)');
  eq(parenthesize('3 * 2 < 4'), '(3 * 2) < 4');
  eq(parenthesize('(*) 3 (2 + 4)'), '(*) 3 (2 + 4)');
  eq(parenthesize('2 ^ 3 ^ 2'), '2 ^ (3 ^ 2)');
  eq(parenthesize('1 - 2 - 3'), '(1 - 2) - 3');
  eq(parenthesize('max 2 3 * 4'), '(max 2 3) * 4');
  eq(parenthesize('10 `div` 3 + 2'), '(10 `div` 3) + 2');
});
test('evalSteps', () => {
  eq(evalSteps('1 + 2 ^ 3 * 4'), { ok: true, steps: ['1 + 2 ^ 3 * 4', '1 + 8 * 4', '1 + 32', '33'], value: '33' });
  eq(evalSteps('(*) 3 (2 + 4)').steps, ['(*) 3 (2 + 4)', '(*) 3 6', '18']);
  eq(evalSteps('3 * 2 < 4').value, 'False');
  eq(evalSteps('7 / 2 + 1').steps, ['7 / 2 + 1', '3.5 + 1', '4.5']);
  eq(evalSteps('1 - 2 - 3').steps, ['1 - 2 - 3', '-1 - 3', '-4']);
  eq(evalSteps('[1] ++ [2]').ok, false);
});
test('exprTree', () => {
  const t = exprTree('1 + 2 ^ 3 * 4').tree;
  eq([t.kind, t.op, t.right.op, t.right.left.op], ['op', '+', '*', '^']);
  eq([t.opStart, t.opEnd], [2, 3]);
  const a = exprTree('(*) 3 (2 + 4)').tree;
  eq([a.kind, a.fn.kind, a.fn.op, a.args.length, a.args[1].op], ['app', 'opfn', '*', 2, '+']);
  eq(exprTree('(+2) 5').tree.fn.kind, 'section');
  eq(exprTree('- 2 ^ 2').tree.kind, 'neg');
  eq(exprTree('1 +').ok, false);
});
test('sameStructure', () => {
  ok(sameStructure('1 + 2 ^ 3 * 4', '(1 + ((2 ^ 3) * 4))'));
  ok(sameStructure('1 + 2 ^ 3 * 4', '1 + ((2 ^ 3) * 4)'));
  ok(!sameStructure('1 + 2 ^ 3 * 4', '(1 + 2) ^ 3 * 4'));
  ok(!sameStructure('1 + 2 ^ 3 * 4', '1 + 2 ^ (3 * 4)'));
  ok(sameStructure('(*) 3 (2 + 4)', '((*) 3 (2 + 4))'));
});

// ---------- výsledek ----------
for (const f of failures) console.log(f);
console.log(`\nengine: ${pass} prošlo, ${fail} selhalo`);
process.exit(fail ? 1 : 0);
