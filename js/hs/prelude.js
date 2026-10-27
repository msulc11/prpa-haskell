// Prelude: primitiva v JS (se signaturami) + zbytek napsaný přímo v Haskellu.
// Primitiva jsou generátory: argumenty vynucují přes yield* W(x), funkce volají přes yield new Call(f, args).

import {
  Thunk, Cons, NIL, Tup, Fn, Call, W, rtError, fromArray, fromStr, toStrG, toNum, toBig,
  numAdd, numSub, numMul, numNeg, numAbs, numSignum, numDivide, intDiv, intMod, intQuot, intRem, numPow,
  roundHalfEven, hsEqG, hsCmpG, enumFrom, enumFromTo, enumFromThen, enumFromThenTo, showRuntimeG, Out,
} from './runtime.js';

const isBig = (x) => typeof x === 'bigint';

const num1 = (f) => function* ([a]) { return f(yield* W(a)); };
const num2 = (f) => function* ([a, b]) { return f(yield* W(a), yield* W(b)); };
const flt1 = (f) => function* ([a]) { return f(toNum(yield* W(a))); };
const charPred = (re) => function* ([c]) { return re.test(yield* W(c)); };
const cmp = (test) => function* ([a, b]) { return test(yield* hsCmpG(a, b)); };

function emptyErr(fn) { return rtError(`Prelude.${fn}: empty list`, `Funkce ${fn} dostala prázdný seznam [].`); }

export const PRIMS = [
  ['+', 'Num a => a -> a -> a', 2, num2(numAdd)],
  ['-', 'Num a => a -> a -> a', 2, num2(numSub)],
  ['*', 'Num a => a -> a -> a', 2, num2(numMul)],
  ['negate', 'Num a => a -> a', 1, num1(numNeg)],
  ['abs', 'Num a => a -> a', 1, num1(numAbs)],
  ['signum', 'Num a => a -> a', 1, num1(numSignum)],
  ['fromInteger', 'Num a => Integer -> a', 1, num1((x) => x)],
  ['fromIntegral', '(Integral a, Num b) => a -> b', 1, num1((x) => x)],
  ['toInteger', 'Integral a => a -> Integer', 1, num1(toBig)],
  ['realToFrac', '(Real a, Fractional b) => a -> b', 1, num1(toNum)],
  ['/', 'Fractional a => a -> a -> a', 2, num2(numDivide)],
  ['recip', 'Fractional a => a -> a', 1, flt1((x) => 1 / x)],
  ['div', 'Integral a => a -> a -> a', 2, num2(intDiv)],
  ['mod', 'Integral a => a -> a -> a', 2, num2(intMod)],
  ['quot', 'Integral a => a -> a -> a', 2, num2(intQuot)],
  ['rem', 'Integral a => a -> a -> a', 2, num2(intRem)],
  ['divMod', 'Integral a => a -> a -> (a, a)', 2, num2((x, y) => new Tup([intDiv(x, y), intMod(x, y)]))],
  ['quotRem', 'Integral a => a -> a -> (a, a)', 2, num2((x, y) => new Tup([intQuot(x, y), intRem(x, y)]))],
  ['^', '(Num a, Integral b) => a -> b -> a', 2, num2(numPow)],
  ['^^', '(Fractional a, Integral b) => a -> b -> a', 2, num2((x, y) => Math.pow(toNum(x), toNum(y)))],
  ['**', 'Floating a => a -> a -> a', 2, num2((x, y) => Math.pow(toNum(x), toNum(y)))],
  ['sqrt', 'Floating a => a -> a', 1, flt1(Math.sqrt)],
  ['exp', 'Floating a => a -> a', 1, flt1(Math.exp)],
  ['log', 'Floating a => a -> a', 1, flt1(Math.log)],
  ['sin', 'Floating a => a -> a', 1, flt1(Math.sin)],
  ['cos', 'Floating a => a -> a', 1, flt1(Math.cos)],
  ['tan', 'Floating a => a -> a', 1, flt1(Math.tan)],
  ['asin', 'Floating a => a -> a', 1, flt1(Math.asin)],
  ['acos', 'Floating a => a -> a', 1, flt1(Math.acos)],
  ['atan', 'Floating a => a -> a', 1, flt1(Math.atan)],
  ['logBase', 'Floating a => a -> a -> a', 2, num2((b, x) => Math.log(toNum(x)) / Math.log(toNum(b)))],
  ['pi', 'Floating a => a', 0, function* () { return Math.PI; }],
  ['truncate', '(RealFrac a, Integral b) => a -> b', 1, num1(toBig)],
  ['round', '(RealFrac a, Integral b) => a -> b', 1, num1(roundHalfEven)],
  ['floor', '(RealFrac a, Integral b) => a -> b', 1, num1((x) => (isBig(x) ? x : toBig(Math.floor(x))))],
  ['ceiling', '(RealFrac a, Integral b) => a -> b', 1, num1((x) => (isBig(x) ? x : toBig(Math.ceil(x))))],
  ['==', 'Eq a => a -> a -> Bool', 2, function* ([a, b]) { return yield* hsEqG(a, b); }],
  ['/=', 'Eq a => a -> a -> Bool', 2, function* ([a, b]) { return !(yield* hsEqG(a, b)); }],
  ['<', 'Ord a => a -> a -> Bool', 2, cmp((c) => c < 0)],
  ['<=', 'Ord a => a -> a -> Bool', 2, cmp((c) => c <= 0)],
  ['>', 'Ord a => a -> a -> Bool', 2, cmp((c) => c > 0)],
  ['>=', 'Ord a => a -> a -> Bool', 2, cmp((c) => c >= 0)],
  ['max', 'Ord a => a -> a -> a', 2, function* ([a, b]) { const x = yield* W(a), y = yield* W(b); return (yield* hsCmpG(x, y)) > 0 ? x : y; }],
  ['min', 'Ord a => a -> a -> a', 2, function* ([a, b]) { const x = yield* W(a), y = yield* W(b); return (yield* hsCmpG(x, y)) <= 0 ? x : y; }],
  ['show', 'Show a => a -> String', 1, function* ([a]) { const out = new Out(Infinity); yield* showRuntimeG(a, out); return fromStr(out.toString()); }],
  ['error', '[Char] -> a', 1, function* ([s]) { throw rtError(yield* toStrG(s)); }],
  ['errorWithoutStackTrace', '[Char] -> a', 1, function* ([s]) { throw rtError(yield* toStrG(s)); }],
  ['seq', 'a -> b -> b', 2, function* ([a, b]) { yield* W(a); return yield* W(b); }],
  ['succ', 'Enum a => a -> a', 1, num1((x) => {
    if (isBig(x)) return x + 1n;
    if (typeof x === 'number') return x + 1;
    if (typeof x === 'string') return String.fromCodePoint(x.codePointAt(0) + 1);
    if (x === false) return true;
    throw rtError('Prelude.Enum.Bool.succ: bad argument');
  })],
  ['pred', 'Enum a => a -> a', 1, num1((x) => {
    if (isBig(x)) return x - 1n;
    if (typeof x === 'number') return x - 1;
    if (typeof x === 'string') return String.fromCodePoint(x.codePointAt(0) - 1);
    if (x === true) return false;
    throw rtError('Prelude.Enum.Bool.pred: bad argument');
  })],
  ['fromEnum', 'Enum a => a -> Int', 1, num1((x) => {
    if (isBig(x)) return x;
    if (typeof x === 'number') return toBig(x);
    if (typeof x === 'string') return BigInt(x.codePointAt(0));
    if (typeof x === 'boolean') return x ? 1n : 0n;
    return 0n;
  })],
  ['enumFrom', 'Enum a => a -> [a]', 1, num1(enumFrom)],
  ['enumFromTo', 'Enum a => a -> a -> [a]', 2, num2(enumFromTo)],
  ['enumFromThen', 'Enum a => a -> a -> [a]', 2, num2(enumFromThen)],
  ['enumFromThenTo', 'Enum a => a -> a -> a -> [a]', 3, function* ([a, b, c]) { return enumFromThenTo(yield* W(a), yield* W(b), yield* W(c)); }],
  [':', 'a -> [a] -> [a]', 2, function* ([h, t]) { return new Cons(h, t); }],
  ['length', '[a] -> Int', 1, function* ([xs]) {
    let n = 0n, l = yield* W(xs);
    while (l instanceof Cons) { n++; l = l.t; if (l instanceof Thunk) l = l.s === 2 ? l.v : yield l; }
    return n;
  }],
  ['sum', 'Num a => [a] -> a', 1, function* ([xs]) {
    let s = 0n, l = yield* W(xs);
    while (l instanceof Cons) { s = numAdd(s, yield* W(l.h)); l = yield* W(l.t); }
    return s;
  }],
  ['product', 'Num a => [a] -> a', 1, function* ([xs]) {
    let s = 1n, l = yield* W(xs);
    while (l instanceof Cons) { s = numMul(s, yield* W(l.h)); l = yield* W(l.t); }
    return s;
  }],
  ['maximum', 'Ord a => [a] -> a', 1, function* ([xs]) {
    let l = yield* W(xs);
    if (!(l instanceof Cons)) throw emptyErr('maximum');
    let m = yield* W(l.h); l = yield* W(l.t);
    while (l instanceof Cons) { const x = yield* W(l.h); if ((yield* hsCmpG(x, m)) >= 0) m = x; l = yield* W(l.t); }
    return m;
  }],
  ['minimum', 'Ord a => [a] -> a', 1, function* ([xs]) {
    let l = yield* W(xs);
    if (!(l instanceof Cons)) throw emptyErr('minimum');
    let m = yield* W(l.h); l = yield* W(l.t);
    while (l instanceof Cons) { const x = yield* W(l.h); if ((yield* hsCmpG(x, m)) < 0) m = x; l = yield* W(l.t); }
    return m;
  }],
  ['elem', 'Eq a => a -> [a] -> Bool', 2, function* ([a, xs]) {
    let l = yield* W(xs);
    while (l instanceof Cons) { if (yield* hsEqG(a, l.h)) return true; l = yield* W(l.t); }
    return false;
  }],
  ['notElem', 'Eq a => a -> [a] -> Bool', 2, function* ([a, xs]) {
    let l = yield* W(xs);
    while (l instanceof Cons) { if (yield* hsEqG(a, l.h)) return false; l = yield* W(l.t); }
    return true;
  }],
  ['reverse', '[a] -> [a]', 1, function* ([xs]) {
    let r = NIL, l = yield* W(xs);
    while (l instanceof Cons) { r = new Cons(l.h, r); l = yield* W(l.t); }
    return r;
  }],
  ['!!', '[a] -> Int -> a', 2, function* ([xs, n]) {
    let k = toBig(yield* W(n));
    if (k < 0n) throw rtError('Prelude.!!: negative index', 'Index do seznamu nesmí být záporný (indexuje se od 0).');
    let l = yield* W(xs);
    while (l instanceof Cons) { if (k === 0n) return yield* W(l.h); k -= 1n; l = yield* W(l.t); }
    throw rtError('Prelude.!!: index too large', 'Seznam je kratší. Indexuje se od 0, poslední prvek má index length xs - 1.');
  }],
  ['foldl', '(b -> a -> b) -> b -> [a] -> b', 3, function* ([f, z, xs]) {
    const fv = yield* W(f);
    let acc = z, l = yield* W(xs);
    while (l instanceof Cons) { acc = yield new Call(fv, [acc, l.h]); l = yield* W(l.t); }
    return yield* W(acc);
  }],
  ['foldl1', '(a -> a -> a) -> [a] -> a', 2, function* ([f, xs]) {
    const fv = yield* W(f);
    let l = yield* W(xs);
    if (!(l instanceof Cons)) throw emptyErr('foldl1');
    let acc = l.h; l = yield* W(l.t);
    while (l instanceof Cons) { acc = yield new Call(fv, [acc, l.h]); l = yield* W(l.t); }
    return yield* W(acc);
  }],
  ['and', '[Bool] -> Bool', 1, function* ([xs]) {
    let l = yield* W(xs);
    while (l instanceof Cons) { if ((yield* W(l.h)) !== true) return false; l = yield* W(l.t); }
    return true;
  }],
  ['or', '[Bool] -> Bool', 1, function* ([xs]) {
    let l = yield* W(xs);
    while (l instanceof Cons) { if ((yield* W(l.h)) === true) return true; l = yield* W(l.t); }
    return false;
  }],
  ['any', '(a -> Bool) -> [a] -> Bool', 2, function* ([p, xs]) {
    const pv = yield* W(p);
    let l = yield* W(xs);
    while (l instanceof Cons) { if ((yield new Call(pv, [l.h])) === true) return true; l = yield* W(l.t); }
    return false;
  }],
  ['all', '(a -> Bool) -> [a] -> Bool', 2, function* ([p, xs]) {
    const pv = yield* W(p);
    let l = yield* W(xs);
    while (l instanceof Cons) { if ((yield new Call(pv, [l.h])) !== true) return false; l = yield* W(l.t); }
    return true;
  }],
  ['ord', 'Char -> Int', 1, num1((c) => BigInt(c.codePointAt(0)))],
  ['chr', 'Int -> Char', 1, num1((n) => {
    const k = Number(n);
    if (k < 0 || k > 0x10ffff) throw rtError('Prelude.chr: bad argument: ' + k);
    return String.fromCodePoint(k);
  })],
  ['toUpper', 'Char -> Char', 1, num1((x) => { const u = x.toUpperCase(); return Array.from(u).length === 1 ? u : x; })],
  ['toLower', 'Char -> Char', 1, num1((x) => { const u = x.toLowerCase(); return Array.from(u).length === 1 ? u : x; })],
  ['isDigit', 'Char -> Bool', 1, charPred(/^[0-9]$/)],
  ['isUpper', 'Char -> Bool', 1, charPred(/^\p{Lu}$/u)],
  ['isLower', 'Char -> Bool', 1, charPred(/^\p{Ll}$/u)],
  ['isAlpha', 'Char -> Bool', 1, charPred(/^\p{L}$/u)],
  ['isLetter', 'Char -> Bool', 1, charPred(/^\p{L}$/u)],
  ['isAlphaNum', 'Char -> Bool', 1, charPred(/^[\p{L}\p{N}]$/u)],
  ['isSpace', 'Char -> Bool', 1, charPred(/^[ \t\n\r\f\v ]$/)],
  ['isPunctuation', 'Char -> Bool', 1, charPred(/^\p{P}$/u)],
  ['digitToInt', 'Char -> Int', 1, num1((x) => {
    if (/^[0-9]$/.test(x)) return BigInt(x.charCodeAt(0) - 48);
    if (/^[a-fA-F]$/.test(x)) return BigInt(parseInt(x, 16));
    throw rtError(`Char.digitToInt: not a digit '${x}'`);
  })],
  ['intToDigit', 'Int -> Char', 1, num1((n) => {
    const k = Number(n);
    if (k >= 0 && k <= 15) return k.toString(16);
    throw rtError('Char.intToDigit: not a digit ' + k);
  })],
  ['undefined', 'a', 0, function* () { throw rtError('Prelude.undefined'); }],
];

export const PRELUDE_SRC = `
infixr 9 .
otherwise = True
(&&) :: Bool -> Bool -> Bool
True && x = x
False && _ = False
(||) :: Bool -> Bool -> Bool
True || _ = True
False || x = x
not :: Bool -> Bool
not True = False
not False = True
id :: a -> a
id x = x
const :: a -> b -> a
const x _ = x
flip :: (a -> b -> c) -> b -> a -> c
flip f x y = f y x
(.) :: (b -> c) -> (a -> b) -> a -> c
(.) f g = \\x -> f (g x)
($) :: (a -> b) -> a -> b
f $ x = f x
($!) :: (a -> b) -> a -> b
f $! x = x \`seq\` f x
fst :: (a, b) -> a
fst (x, _) = x
snd :: (a, b) -> b
snd (_, y) = y
curry :: ((a, b) -> c) -> a -> b -> c
curry f x y = f (x, y)
uncurry :: (a -> b -> c) -> (a, b) -> c
uncurry f p = f (fst p) (snd p)
until :: (a -> Bool) -> (a -> a) -> a -> a
until p f x = if p x then x else until p f (f x)
subtract :: Num a => a -> a -> a
subtract x y = y - x
even :: Integral a => a -> Bool
even n = n \`rem\` 2 == 0
odd :: Integral a => a -> Bool
odd n = not (even n)
gcd :: Integral a => a -> a -> a
gcd a b = gcd' (abs a) (abs b)
  where gcd' x 0 = x
        gcd' x y = gcd' y (x \`rem\` y)
lcm :: Integral a => a -> a -> a
lcm _ 0 = 0
lcm 0 _ = 0
lcm x y = abs ((x \`quot\` (gcd x y)) * y)
errorEmptyList fun = errorWithoutStackTrace ("Prelude." ++ fun ++ ": empty list")
head :: [a] -> a
head (x:_) = x
head [] = errorEmptyList "head"
tail :: [a] -> [a]
tail (_:xs) = xs
tail [] = errorEmptyList "tail"
last :: [a] -> a
last [x] = x
last (_:xs) = last xs
last [] = errorEmptyList "last"
init :: [a] -> [a]
init [x] = []
init (x:xs) = x : init xs
init [] = errorEmptyList "init"
null :: [a] -> Bool
null [] = True
null (_:_) = False
map :: (a -> b) -> [a] -> [b]
map _ [] = []
map f (x:xs) = f x : map f xs
filter :: (a -> Bool) -> [a] -> [a]
filter _ [] = []
filter p (x:xs) = if p x then x : filter p xs else filter p xs
(++) :: [a] -> [a] -> [a]
(++) [] ys = ys
(++) (x:xs) ys = x : (xs ++ ys)
foldr :: (a -> b -> b) -> b -> [a] -> b
foldr _ z [] = z
foldr f z (x:xs) = f x (foldr f z xs)
foldr1 :: (a -> a -> a) -> [a] -> a
foldr1 _ [x] = x
foldr1 f (x:xs) = f x (foldr1 f xs)
foldr1 _ [] = errorEmptyList "foldr1"
concat :: [[a]] -> [a]
concat [] = []
concat (xs:xss) = xs ++ concat xss
concatMap :: (a -> [b]) -> [a] -> [b]
concatMap f xs = concat (map f xs)
take :: Int -> [a] -> [a]
take n xs = if n <= 0 then [] else case xs of
  [] -> []
  (y:ys) -> y : take (n - 1) ys
drop :: Int -> [a] -> [a]
drop n xs = if n <= 0 then xs else case xs of
  [] -> []
  (_:ys) -> drop (n - 1) ys
splitAt :: Int -> [a] -> ([a], [a])
splitAt n xs = (take n xs, drop n xs)
takeWhile :: (a -> Bool) -> [a] -> [a]
takeWhile _ [] = []
takeWhile p (x:xs) = if p x then x : takeWhile p xs else []
dropWhile :: (a -> Bool) -> [a] -> [a]
dropWhile _ [] = []
dropWhile p xs@(x:xs') = if p x then dropWhile p xs' else xs
span :: (a -> Bool) -> [a] -> ([a], [a])
span _ [] = ([], [])
span p xs@(x:xs') = if p x then (let (ys, zs) = span p xs' in (x:ys, zs)) else ([], xs)
break :: (a -> Bool) -> [a] -> ([a], [a])
break p xs = span (not . p) xs
zip :: [a] -> [b] -> [(a, b)]
zip (x:xs) (y:ys) = (x, y) : zip xs ys
zip _ _ = []
zip3 :: [a] -> [b] -> [c] -> [(a, b, c)]
zip3 (x:xs) (y:ys) (z:zs) = (x, y, z) : zip3 xs ys zs
zip3 _ _ _ = []
zipWith :: (a -> b -> c) -> [a] -> [b] -> [c]
zipWith f (x:xs) (y:ys) = f x y : zipWith f xs ys
zipWith _ _ _ = []
zipWith3 :: (a -> b -> c -> d) -> [a] -> [b] -> [c] -> [d]
zipWith3 f (x:xs) (y:ys) (z:zs) = f x y z : zipWith3 f xs ys zs
zipWith3 _ _ _ _ = []
unzip :: [(a, b)] -> ([a], [b])
unzip ps = (map fst ps, map snd ps)
unzip3 :: [(a, b, c)] -> ([a], [b], [c])
unzip3 ps = (map (\\(a, _, _) -> a) ps, map (\\(_, b, _) -> b) ps, map (\\(_, _, c) -> c) ps)
replicate :: Int -> a -> [a]
replicate n x = take n (repeat x)
repeat :: a -> [a]
repeat x = let xs = x : xs in xs
cycle :: [a] -> [a]
cycle [] = errorEmptyList "cycle"
cycle xs = let ys = xs ++ ys in ys
iterate :: (a -> a) -> a -> [a]
iterate f x = x : iterate f (f x)
scanl :: (b -> a -> b) -> b -> [a] -> [b]
scanl f q ls = q : (case ls of
  [] -> []
  (x:xs) -> scanl f (f q x) xs)
scanl1 :: (a -> a -> a) -> [a] -> [a]
scanl1 f (x:xs) = scanl f x xs
scanl1 _ [] = []
scanr :: (a -> b -> b) -> b -> [a] -> [b]
scanr _ q0 [] = [q0]
scanr f q0 (x:xs) = let qs = scanr f q0 xs in f x (head qs) : qs
lines :: String -> [String]
lines "" = []
lines s = let (l, s') = break (== '\\n') s in l : (case s' of
  [] -> []
  (_:s'') -> lines s'')
unlines :: [String] -> String
unlines ls = concatMap (++ "\\n") ls
words :: String -> [String]
words s = case dropWhile isSpace s of
  "" -> []
  s' -> let (w, s'') = break isSpace s' in w : words s''
unwords :: [String] -> String
unwords [] = ""
unwords ws = foldr1 (\\w s -> w ++ ' ' : s) ws
`;

export const HIDDEN = new Set(['errorEmptyList']);

export function primFn(name, arity, impl) {
  if (arity === 0) return new Thunk(() => impl([]), null, true);
  return new Fn(arity, impl, [], name);
}

export { fromArray };
