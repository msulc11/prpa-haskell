// Porovná výstupy enginu se skutečným GHC.
//   node tests/tools/engine-vs-ghc.mjs            – vestavěná sada
//   import { compareWithGhc } from './engine-vs-ghc.mjs'  – vlastní případy
//
// Případ: { name, src, exprs: ['výraz', …] }               – výstupy print (nebo runtime chyby) se musí shodovat
//         { name, src, compileError: 'type'|'parse'|'scope', ghcUse?: 'výraz' }
//            – engine musí odmítnout modul chybou daného druhu a GHC ho musí odmítnout taky
//              (ghcUse: GHC chybu odloží až na použití – pak se zkompiluje main = print (ghcUse))

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Session } from '../../js/hs/index.js';
import { EXTRA_CASES } from './engine-ghc-extra.mjs';

const GHC_BIN = process.env.GHC_BIN || 'C:/Users/matej/ghc-9.12.4-x86_64-unknown-mingw32-int_native/ghc-9.12.4-x86_64-unknown-mingw32/bin';
const WORK = process.env.HS_WORK || 'C:/Users/matej/AppData/Local/Temp/claude/C--Users-matej-Desktop-prpa/2aab20d0-6c0b-4b66-8668-90811514dfa9/scratchpad/ghc-cmp';

const DATA_CHAR = /\b(toUpper|toLower|isDigit|isUpper|isLower|isAlpha|isLetter|isAlphaNum|isSpace|isPunctuation|ord|chr|digitToInt|intToDigit)\b/;

function ghcModule(src, exprs) {
  const imports = ['{-# LANGUAGE ExtendedDefaultRules #-}', 'import qualified Control.Exception as CE__'];
  if (DATA_CHAR.test(src) || exprs.some((e) => DATA_CHAR.test(e))) imports.push('import Data.Char');
  const body = src.replace(/^\s*import\s+Data\.Char.*$/gm, '');
  const lines = [
    ...imports,
    body,
    '',
    'pr__ :: Show a => a -> IO ()',
    'pr__ x = do',
    '  r <- CE__.try (CE__.evaluate (let s = show x in length s `seq` s))',
    '  case r of',
    '    Left e -> putStrLn ("ERR " ++ head (lines (show (e :: CE__.SomeException)) ++ [""]))',
    '    Right s -> putStrLn s',
    '',
    'main :: IO ()',
    'main = do',
    ...exprs.map((e) => `  pr__ (${e})`),
  ];
  return lines.join('\n') + '\n';
}

function runGhc(dir, file) {
  const r = spawnSync(join(GHC_BIN, 'runghc.exe'), [file], { cwd: dir, encoding: 'utf8', timeout: 120000, env: { ...process.env, LANG: 'C.UTF-8' } });
  return { code: r.status, out: (r.stdout || '').replace(/\r/g, ''), err: (r.stderr || '').replace(/\r/g, '') };
}
function compileGhc(dir, file) {
  const r = spawnSync(join(GHC_BIN, 'ghc.exe'), ['-fno-code', file], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function normErr(msg) {
  return msg
    .replace(/^\*\*\* Exception: /, '')
    .replace(/^.*?:\(?\d+,?\d*\)?(?:-\(?\d+,?\d*\)?)?: (?=Non-exhaustive)/, '')
    .replace(/^[^:]*\.hs:[\d:()\-,]+: (?=Non-exhaustive)/, '')
    .trim();
}

export function compareWithGhc(cases, { verbose = false } = {}) {
  mkdirSync(WORK, { recursive: true });
  const results = [];
  cases.forEach((c, idx) => {
    const dir = join(WORK, `case${idx}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const s = new Session();
    const loaded = s.load(c.src);
    if (c.compileError) {
      const engineOk = !loaded.ok && loaded.error.kind === c.compileError;
      let ghcFile;
      if (c.ghcUse) ghcFile = c.src + `\n\nmain :: IO ()\nmain = print (${c.ghcUse})\n`;
      else ghcFile = c.src + (/\bmain\b/.test(c.src) ? '' : '\n\nmain :: IO ()\nmain = return ()\n');
      writeFileSync(join(dir, 'Main.hs'), ghcFile);
      const g = compileGhc(dir, 'Main.hs');
      const ghcFails = g.code !== 0;
      const ok = engineOk && ghcFails;
      results.push({ name: c.name, ok, detail: ok ? '' : `engine=${JSON.stringify(loaded.ok ? 'OK' : loaded.error)} ghcFails=${ghcFails}\n${g.out.slice(0, 600)}` });
      return;
    }
    if (!loaded.ok) {
      results.push({ name: c.name, ok: false, detail: 'engine load failed: ' + JSON.stringify(loaded.error) });
      return;
    }
    writeFileSync(join(dir, 'Main.hs'), ghcModule(c.src, c.exprs));
    const g = runGhc(dir, 'Main.hs');
    if (g.code !== 0) {
      results.push({ name: c.name, ok: false, detail: 'GHC failed:\n' + g.err.slice(0, 1500) });
      return;
    }
    const ghcLines = g.out.split('\n');
    c.exprs.forEach((e, i) => {
      const r = s.eval(e, { fuel: 20_000_000, maxOutput: 100000 });
      const engine = r.ok ? r.output : (r.error.kind === 'runtime' ? 'ERR ' + normErr(r.error.message) : `[${r.error.kind}] ${r.error.message}`);
      let ghc = ghcLines[i] ?? '<chybí>';
      if (ghc.startsWith('ERR ')) ghc = 'ERR ' + normErr(ghc.slice(4));
      const ok = engine === ghc;
      if (verbose || !ok) results.push({ name: `${c.name}: ${e}`, ok, detail: ok ? '' : `engine: ${engine}\n   ghc: ${ghc}` });
      else results.push({ name: `${c.name}: ${e}`, ok });
    });
  });
  return results;
}

// ---------- vestavěná sada ----------
const PRPA = (() => {
  try { return readFileSync('C:/Users/matej/Desktop/prpa/prpa.hs', 'utf8'); } catch { return null; }
})();

export const DEFAULT_CASES = [
  {
    name: 'výrazy z písemek',
    src: '',
    exprs: ['1 + 2 ^ 3 * 4', '3 * 2 < 4', '(*) 3 (2 + 4)', '2^3^2', '(2^3)^2', '1-2-3', '1-(2-3)', 'sqrt (3^2 + 4^2)',
      '10 `div` 3 + 2', '10 `mod` 4 * 3', '2 + 3 == 5', 'not (3 > 2) || 1 < 2', 'max 2 3 * 4', '(+2) 5 * 3', '(`div` 2) 9',
      '(subtract 3) 10', '- 2 ^ 2', '(-2) ^ 2', '7 / 2', '2 ** 10', '10 / 4 * 2', 'min 3 4 + max 1 2', '3 * 2 > 4 && 1 /= 1',
      'negate 5 + 2', 'abs (-3) * 2', 'even 4 && odd 3', '17 `rem` (-5)', '17 `mod` (-5)', '(-17) `div` 5', '(-17) `quot` 5'],
  },
  {
    name: 'prelude',
    src: '',
    exprs: ['map (+1) [1,2,3]', 'filter even [1..20]', 'take 5 (iterate (*2) 1)', 'zip [1,2,3] "abc"', 'words "  ahoj   svete  "',
      'unwords ["a","b"]', 'lines "a\\nb\\n\\nc"', 'unlines ["a","b"]', 'reverse [1..5]', 'concat [[1],[2,3],[]]', 'concatMap show [1,2,3]',
      'and []', 'or [False,True]', 'any even [1,3]', 'all odd [1,3]', 'elem 3 [1,2,3]', 'notElem 3 [1,2]', 'replicate 3 \'x\'',
      'splitAt 2 [1,2,3,4]', 'span even [2,4,5,6]', 'break (>3) [1..6]', 'takeWhile (<4) [1..]', 'dropWhile (<4) [1..8]',
      'foldr (-) 0 [1,2,3]', 'foldl (-) 0 [1,2,3]', 'foldr1 max [3,1,4]', 'scanl (+) 0 [1,2,3]', 'scanr (+) 0 [1,2,3]', 'scanl1 (+) [1,2,3]',
      'zipWith3 (\\a b c -> a+b+c) [1,2] [3,4] [5,6]', 'unzip [(1,\'a\'),(2,\'b\')]', 'lookup1 2', 'head [5,6]', 'tail [5,6]', 'last [5,6]', 'init [5,6]',
      'null []', 'length "ahoj"', '[1,2,3] !! 1', 'sum [1..100]', 'product [1..20]', 'maximum "hello"', 'minimum [3,1,2]', 'gcd 12 18', 'lcm 4 6',
      'fst (1,2)', 'snd (1,2)', 'until (>100) (*2) 1', 'flip (-) 1 10', '(map (*2) . filter odd) [1..10]', 'show 12', 'show "a\\"b"', 'show \'x\'',
      'succ \'a\'', 'pred 10', 'fromEnum \'A\'', 'toUpper \'a\'', 'ord \'a\'', 'chr 98', 'digitToInt \'7\'', 'isDigit \'5\'', '[\'a\'..\'f\']', '[1,3..11]', '[10,8..1]',
      '[5..1]', 'head []', 'tail []', '[1,2] !! 5', '1 `div` 0', 'maximum []', 'error "moje chyba"', 'divMod 7 2', 'quotRem (-7) 2', 'curry fst 1 2', 'uncurry (+) (3,4)'],
    srcExtra: 'lookup1 k = [v | (k2, v) <- [(1,"a"),(2,"b")], k2 == k]',
  },
  {
    name: 'čísla a show',
    src: '',
    exprs: ['0.1 + 0.2', '1/3', '2/3 * 3', '1.0e-2', '0.1', '12345678.9', '1234567.0', '1.0e7', '123.456', '5 / 2', '-0.5', 'sqrt 2', 'pi',
      'fromIntegral (length [1,2,3]) / 2', 'truncate 2.7', 'round 2.5', 'round 3.5', 'round (-2.5)', 'floor (-2.5)', 'ceiling 2.1', '2 ^ 64', 'product [1..25]',
      '[0.1,0.2..0.5]', '[1.0,1.5..3.0]', '[1.0..3.5]', '3 `div` 2 + 1', '(-3) `mod` 5', 'show (-5)', 'show [(-1)]', '[-1,-2]', '(1,-2)', 'show 1.0e-4',
      '"čau\\n"', '"tab\\there"', 'show "\\1234\\&5"', '\'\\n\'', '"\\SOH"', 'recip 4', 'logBase 2 1024', '10 ** 2', '2 ^^ (-2)', 'signum (-7)', 'abs (-7.5)'],
  },
  {
    name: 'řešení úloh',
    src: `fce3 x y = if x < y then x * y else x - y

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

zdvojLiche2 xs = [if odd x then 2 * x else x | x <- xs]

ztrojSude [] = []
ztrojSude (x:xs) = (if even x then 3 * x else x) : ztrojSude xs

ztrojSude2 xs = map (\\x -> if even x then 3 * x else x) xs

zapornaPosloupnost a
  | a > 0 = zp 1
  | otherwise = []
  where zp k | k > a = []
             | otherwise = (-k) : zp (k + 1)

zapornaPosloupnost2 a = if a > 0 then [-1, -2 .. -a] else []
zapornaPosloupnost3 a = [-x | x <- [1..a]]

delitele n = [d | d <- [1..n], n \`mod\` d == 0]
prvocislo n = n > 1 && delitele n == [1, n]
soucetSudych xs = sum [x | x <- xs, even x]
pocetVyskytu a xs = length (filter (== a) xs)
otoc xs = otoc' xs []
  where otoc' [] a = a
        otoc' (y:ys) a = otoc' ys (y:a)
`,
    exprs: ['fce3 2 5', 'fce3 5 2', 'fce3 3 3', 'fce3 (-1) 4', 'nejvetsi3 1 7 3', 'nejvetsi3 9 7 3', 'nejvetsi3 1 2 8', 'nejvetsi3 5 5 5',
      'fce4 (-1) 5', 'fce4 0 5', 'fce4 3 5', 'zdvojLiche [1,2,3]', 'zdvojLiche []', 'zdvojLiche [-3,4]', 'zdvojLiche2 [1..6]', 'ztrojSude [1,2,3,4]',
      'ztrojSude2 [0,-2,5]', 'zapornaPosloupnost 4', 'zapornaPosloupnost 0', 'zapornaPosloupnost (-2)', 'zapornaPosloupnost2 3', 'zapornaPosloupnost3 5',
      'delitele 28', 'filter prvocislo [1..30]', 'soucetSudych [1..10]', 'pocetVyskytu 2 [1,2,2,3]', 'otoc [1,2,3]', 'otoc "abc"'],
  },
  {
    name: 'layout, let, where, case, lambda',
    src: `f x = let y = x * 2
          z = y + 1
      in y + z

g x = case x of
  0 -> "nula"
  1 -> "jedna"
  _ -> "hodne"

h xs = [y | x <- xs, let y = x * x, odd y]

k (a, b) = a + b

m = \\x y -> x * 10 + y

n xs@(x:_) = (x, length xs)
n [] = (0, 0)

p x
  | x < 10 = small
  | otherwise = big
  where small = "male"
        big = "velke"

q :: Int -> Int -> Int
q a b = a \`div\` b

r = [(i, j) | i <- [1..3], j <- [i..3]]

s 0 = "nula"
s n | n < 0 = "zaporne"
    | n > 100 = "velke"
s _ = "jine"
`,
    exprs: ['f 3', 'g 0', 'g 1', 'g 7', 'h [1..6]', 'k (3, 4)', 'm 4 2', 'n [5,6,7]', 'n []', 'p 3', 'p 30', 'q 7 2', 'r', 's 0', 's (-5)', 's 500', 's 50',
      'let a = 5 in a * a', 'let f 0 = 1; f k = k * f (k - 1) in f 10', '(\\(a, b) -> a * b) (3, 4)', 'case [1,2,3] of { (x:y:_) -> x + y; _ -> 0 }'],
  },
];

if (PRPA) {
  DEFAULT_CASES.push({
    name: 'prpa.hs',
    src: PRPA,
    exprs: ['dvojnasobek 5', 'soucetCtvercu 3 4', 'jeMensi 2 3', 'jeVetsi 2 3', 'mensi 4 2', 'vetsi 4 2', 'logickySoucet True False', 'logickySoucin True False',
      'logickySoucet2 False False', 'logickySoucet3 False True', "logickySoucin' True True", 'absolutniHodnota (-4)', "absolutniHodnota' 7", "signum' (-3)",
      "signum' 0", 'faktorial 10', "faktorial' 15", "faktorial'' 20", "faktorial'' (-1)", 'zbytekPoDeleni 17 5', 'zbytekPoDeleni 3 0', 'nsd 12 18', 'nsd 17 5',
      'prvni [1,2,3]', 'druhy [1,2,3]', 'telo [1,2,3]', 'posledniPrvek [1,2,3]', 'predposledniPrvek [1,2,3]', 'prvek 1 [1,2,3]', 'prvek 3 [1,2,3]',
      'nty 2 [5,6,7]', 'nty 5 [1]', 'delka [1..2000]', 'soucet [1..100]', 'soucin [1..10]', 'smazPrvni 2 [1,2,3,2]', 'smazVsechny 2 [1,2,3,2]', 'zvysO2 5',
      'umocniNa6 2', 'umocni6 2', 'aplikujBinarniFunkci 1 2 (+)', 'aplikujBinarniFunkci 7 2 div', 'zvys [1,2,3]', 'prvni []', 'posledniPrvek []'],
  });
}

DEFAULT_CASES.push(
  { name: 'fch1 (písemka)', src: 'fch1 a = if 2 * a < 100 then 1 else [0]', compileError: 'type', ghcUse: 'fch1 3' },
  { name: 'fch2 (písemka)', src: 'fch2 a = if a * 10 then a < 10 else a > 10', compileError: 'type' },
  { name: 'fch4 (písemka)', src: 'fch4 a b = if a = b then a else a - b', compileError: 'parse' },
  { name: 'chybí else', src: 'f x = if x > 0 then 1', compileError: 'parse' },
  { name: '!=', src: 'g x = x != 2', compileError: 'scope' },
  { name: 'velké písmeno', src: 'Fch a = 1', compileError: 'scope' },
  { name: 'chybí kontext', src: 'f :: a -> a\nf x = x + 1', compileError: 'type' },
  { name: 'length / 2', src: 'h xs = length xs / 2', compileError: 'type' },
  { name: 'vzor bez závorek', src: 'f x:xs = x', compileError: 'parse' },
  { name: 'x : x', src: 'z (x:xs) = x : x', compileError: 'type' },
  { name: 'nejednoznačné signum', src: 'signum a = 1\nw = signum 3', compileError: 'scope' },
  { name: 'stráže bez odsazení', src: 'f x\n| x > 0 = 1\n| otherwise = 0', compileError: 'parse' },
  { name: 'řetězení ==', src: 'f a b c = a == b == c', compileError: 'parse' },
  { name: 'Bool vs String', src: 'f x = if x > 0 then True else "ne"', compileError: 'type' },
  { name: 'číslo + String', src: 'f x = "a" + 1', compileError: 'type' },
  { name: 'různý počet argumentů', src: 'f 0 = 1\nf a b = 2', compileError: 'scope' },
  { name: 'duplicitní proměnná', src: 'f x x = 1', compileError: 'scope' },
  { name: 'soucet s :', src: 'soucet [] = 0\nsoucet (x:xs) = x : soucet xs', compileError: 'type', ghcUse: 'soucet [1,2,3]' },
  { name: 'stráž s ->', src: 'f x | x > 0 -> 1', compileError: 'parse' },
  { name: 'mod místo `mod`', src: 'f a = a mod 2 == 0\nw = f 4', compileError: 'type' },
);

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  // případ prelude potřebuje pomocnou definici
  for (const c of DEFAULT_CASES) if (c.srcExtra) c.src = (c.src ? c.src + '\n' : '') + c.srcExtra;
  const t0 = Date.now();
  const res = compareWithGhc([...DEFAULT_CASES, ...EXTRA_CASES], { verbose: process.argv.includes('-v') });
  let pass = 0, fail = 0;
  for (const r of res) {
    if (r.ok) pass++;
    else { fail++; console.log('✗', r.name, '\n  ', r.detail); }
  }
  console.log(`\nengine vs GHC: ${pass} shod, ${fail} rozdílů (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(fail ? 1 : 0);
}

export { fileURLToPath };
