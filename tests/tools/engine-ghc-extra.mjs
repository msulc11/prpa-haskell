// Další případy pro engine-vs-ghc.mjs: styly zápisu, rekurze, typické chyby.

export const EXTRA_CASES = [
  {
    name: 'styly',
    src: `-- komentar
{- blokovy
   {- vnoreny -} komentar -}
f1 x =
  if x > 0
    then "kladne"
    else if x < 0
      then "zaporne"
      else "nula"

f2 :: Integer -> Integer
f2 n
    | n <= 1    = 1
    | otherwise = n * f2 (n - 1)

f3 :: [Int] -> Int
f3 xs = sum [x | x <- xs, x > 0, even x]

f4 :: (Int, Int) -> Int
f4 (a, b) = a * b

f5 :: String -> String
f5 s = "Ahoj, " ++ s ++ "!"

f6 :: Double -> Double -> Double
f6 a b = (a + b) / 2

f7 x y = show x ++ " a " ++ show y

f8 (x:y:rest) = x + y + length rest
f8 _ = 0

f9 xs = case xs of
  [] -> "prazdny"
  [_] -> "jeden"
  (x:_) | x > 10 -> "velky zacatek"
        | otherwise -> "dalsi"

f10 n = pom n 0
  where
    pom 0 acc = acc
    pom k acc = pom (k - 1) (acc + k)

délka [] = 0
délka (_:xs) = 1 + délka xs

f11 xs = [if even x then x * 2 else x | x <- xs, x /= 3]

infixl 6 +++
a +++ b = a * 10 + b

f12 x = let g 0 = 1
            g k = k * g (k - 1)
        in g x + 1

f13 = (\`elem\` [1,2,3])
f14 s = [c | c <- s, c \`elem\` "aeiou"]
f15 n = [(a, b) | a <- [1..n], b <- [a..n], a * b == n]
f16 x | x > 0, even x = "kladne sude"
      | x > 0 = "kladne liche"
      | otherwise = "jine"
f17 "ahoj" = 1
f17 _ = 0
f18 xs = zip xs (tail xs)
f19 n = [x * x | x <- [1..n-1]]
f20 = map (\\(a, b) -> a + b)
f21 xs = foldr (\\x acc -> x + 2 * acc) 0 xs
f22 a b
  | a > b     = a - b
  | a < b     = b - a
  | otherwise = 0
  where _unused = a
f23 xs = maximum xs - minimum xs
f24 c = if isUpper c then toLower c else toUpper c
f25 x = fromIntegral x / 2
f26 :: Int -> Double
f26 x = fromIntegral x * 1.5
`,
    exprs: ['f1 5', 'f1 (-2)', 'f1 0', 'f2 20', 'f3 [1..10]', 'f4 (3, 4)', 'f5 "svete"', 'f6 3 4', 'f7 1 True', 'f8 [1,2,3,4]', 'f8 [1]',
      'f9 []', 'f9 [1]', 'f9 [20, 1]', 'f9 [2, 3]', 'f10 100', 'délka "příliš"', 'f11 [1..6]', '1 +++ 2 +++ 3', 'f12 5', 'f13 2', 'f14 "programovani"',
      'f15 12', 'f16 4', 'f16 3', 'f16 (-1)', 'f17 "ahoj"', 'f17 "cau"', 'f18 [1,2,3]', 'f19 5', 'f20 [(1,2),(3,4)]', 'f21 [1,2,3]', 'f22 3 8', 'f22 8 3',
      'f22 2 2', 'f23 [3,9,1]', 'map f24 "AhOj"', 'f25 3', 'f26 4', 'f6 1 2 > 1', '(f2 . fromIntegral) 5'],
  },
  {
    name: 'rekurze a seznamy',
    src: `posledni [x] = x
posledni (_:xs) = posledni xs
spoj [] ys = ys
spoj (x:xs) ys = x : spoj xs ys
obrat [] = []
obrat (x:xs) = obrat xs ++ [x]
vloz x [] = [x]
vloz x (y:ys) | x <= y = x : y : ys
              | otherwise = y : vloz x ys
trid [] = []
trid (x:xs) = vloz x (trid xs)
qs [] = []
qs (p:xs) = qs [x | x <- xs, x < p] ++ [p] ++ qs [x | x <- xs, x >= p]
fib 0 = 0
fib 1 = 1
fib n = fib (n - 1) + fib (n - 2)
fibs = 0 : 1 : zipWith (+) fibs (tail fibs)
prvocisla = sito [2..] where sito (p:xs) = p : sito [x | x <- xs, x \`mod\` p /= 0]
mocniny2 n = [2 ^ k | k <- [0..n]]
cifSoucet 0 = 0
cifSoucet n = n \`mod\` 10 + cifSoucet (n \`div\` 10)
nahrad a b xs = [if x == a then b else x | x <- xs]
kazdyDruhy (x:_:xs) = x : kazdyDruhy xs
kazdyDruhy xs = xs
binar 0 = "0"
binar 1 = "1"
binar n = binar (n \`div\` 2) ++ show (n \`mod\` 2)
`,
    exprs: ['posledni [1,2,3]', 'spoj [1,2] [3]', 'obrat [1..5]', 'trid [5,2,8,1]', 'qs [3,1,4,1,5,9,2,6]', 'fib 15', 'take 12 fibs', 'take 10 prvocisla',
      'mocniny2 10', 'cifSoucet 12345', 'nahrad 1 0 [1,2,1]', 'kazdyDruhy [1..9]', 'binar 10', 'trid "haskell"', 'qs ["b","a","c"]', 'length (show (2^100))'],
  },
  {
    name: 'další chyby',
    src: 'f x = x ++ 1', compileError: 'type', ghcUse: 'f [1]',
  },
  { name: 'Integral + Fractional', src: 'f x = x / 2 + x `div` 2\nw = f 3', compileError: 'type' },
  { name: 'if bez then', src: 'f x = if x > 1 2 else 3', compileError: 'parse' },
  { name: 'neukončený řetězec', src: 'f x = "ahoj', compileError: 'parse' },
  { name: 'chybějící závorka', src: 'f x = (x + 1', compileError: 'parse' },
  { name: 'aplikace bez závorek', src: 'f n = n * g n - 1\ng :: Int -> Int\ng x = x\nh = f True', compileError: 'type' },
  { name: 'signatura nesedí', src: 'f :: Int -> Bool\nf x = x + 1', compileError: 'type' },
  { name: 'signatura String', src: 'f :: String -> Int\nf s = s', compileError: 'type' },
  { name: 'odsazení where', src: 'f x = y\nwhere y = 1', compileError: 'parse' },
  { name: 'f -1', src: 'f :: Int -> Int\nf x = x\nw = f -1', compileError: 'type' },
  { name: 'nedefinovaná funkce', src: 'f x = dvakrat x', compileError: 'scope' },
  { name: 'head + tail', src: 'f xs = head xs + tail xs', compileError: 'type', ghcUse: 'f [1]' },
];

