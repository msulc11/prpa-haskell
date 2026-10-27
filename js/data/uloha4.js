// Úloha 4 (3 body): napsat funkci nad seznamem (rekurze se vzory, rozsahy, generátor seznamu).
// `expected` je přesný výstup GHCi, ověřený skutečným GHC (tests/content-ghc.test.js).
// Prázdný seznam má v testech vždy jednoznačný typ, např. `([] :: [Int])`.

const t = (expr, expected) => ({ expr, expected })
const rek = (code) => ({ label: 'rekurze', code })
const gen = (code) => ({ label: 'generátor seznamu', code })

export const tasks = [
  // ---- známé varianty z písemek ----
  {
    id: 'u4-zdvojliche',
    source: 'Písemka, varianta 1',
    name: 'zdvojLiche',
    signature: 'zdvojLiche xs',
    text: 'Napište funkci zdvojLiche xs, která v seznamu xs zdvojnásobí všechny prvky, jejichž hodnota je lichá.',
    topic: 'seznamy',
    tests: [t('zdvojLiche [1,2,3,4,5]', '[2,2,6,4,10]'), t('zdvojLiche [2,4,6]', '[2,4,6]'), t('zdvojLiche [-3,0,7]', '[-6,0,14]'), t('zdvojLiche [1]', '[2]'), t('zdvojLiche ([] :: [Int])', '[]')],
    solutions: [
      rek('zdvojLiche [] = []\nzdvojLiche (x:xs)\n    | odd x = 2 * x : zdvojLiche xs\n    | otherwise = x : zdvojLiche xs'),
      gen('zdvojLiche xs = [if odd x then 2 * x else x | x <- xs]'),
    ],
    hints: [
      'Ostatní (sudé) prvky v seznamu zůstanou, jen se nezmění. Délka výsledku je stejná.',
      'Rekurze: `zdvojLiche [] = []` a pro `(x:xs)` rozhodni, co dát na začátek před `zdvojLiche xs`.',
      'Lichost testuje funkce `odd` (nebo `mod x 2 == 1`).',
    ],
  },
  {
    id: 'u4-zapornaposloupnost',
    source: 'Písemka, varianta 4',
    name: 'zapornaPosloupnost',
    signature: 'zapornaPosloupnost a',
    text: 'Napište funkci zapornaPosloupnost a, která pro a > 0 vrátí seznam s prvky ve tvaru -1, -2, ..., -a. V opačném případě vrátí prázdný seznam.',
    topic: 'generátor seznamu',
    tests: [t('zapornaPosloupnost 5', '[-1,-2,-3,-4,-5]'), t('zapornaPosloupnost 1', '[-1]'), t('zapornaPosloupnost 0', '[]'), t('zapornaPosloupnost (-3)', '[]')],
    solutions: [
      gen('zapornaPosloupnost a = [-x | x <- [1..a]]'),
      { label: 'rozsah', code: 'zapornaPosloupnost a\n    | a > 0 = [-1, -2 .. (-a)]\n    | otherwise = []' },
      rek('zapornaPosloupnost a = if a <= 0 then [] else zapornaPosloupnost (a - 1) ++ [-a]'),
    ],
    hints: [
      'Pro a ≤ 0 je rozsah `[1..a]` prázdný, takže generátor seznamu „opačný případ“ vyřeší sám.',
      'Rozsah s krokem: `[-1, -2 .. (-a)]`, první dva prvky určují krok.',
    ],
  },
  {
    id: 'u4-ztrojsude',
    source: 'Písemka, varianta 2',
    name: 'ztrojSude',
    signature: 'ztrojSude xs',
    text: 'Napište funkci ztrojSude xs, která v seznamu xs ztrojnásobí všechny prvky, jejichž hodnota je sudá.',
    topic: 'seznamy',
    tests: [t('ztrojSude [1,2,3,4]', '[1,6,3,12]'), t('ztrojSude [0,5]', '[0,5]'), t('ztrojSude [-2,7]', '[-6,7]'), t('ztrojSude ([] :: [Int])', '[]')],
    solutions: [
      rek('ztrojSude [] = []\nztrojSude (x:xs)\n    | even x = 3 * x : ztrojSude xs\n    | otherwise = x : ztrojSude xs'),
      gen('ztrojSude xs = [if even x then 3 * x else x | x <- xs]'),
    ],
    hints: ['Stejný tvar jako zdvojLiche, jen jiná podmínka (`even`) a jiný násobek.', 'Nula je sudá: 3 * 0 = 0.'],
  },

  // ---- procházení seznamu (map / filter) ----
  {
    id: 'u4-zvys',
    source: null,
    name: 'zvys',
    signature: 'zvys xs',
    text: 'Napište funkci zvys xs, která každý prvek seznamu xs zvýší o 1.',
    topic: 'rekurze',
    tests: [t('zvys [1,2,3]', '[2,3,4]'), t('zvys [-1]', '[0]'), t('zvys ([] :: [Int])', '[]')],
    solutions: [rek('zvys [] = []\nzvys (x:xs) = (x + 1) : zvys xs'), gen('zvys xs = [x + 1 | x <- xs]')],
    hints: ['Šablona rekurze nad seznamem: `f [] = []` a `f (x:xs) = (něco s x) : f xs`.'],
  },
  {
    id: 'u4-ctverceprvku',
    source: null,
    name: 'umocniVse',
    signature: 'umocniVse xs',
    text: 'Napište funkci umocniVse xs, která vrátí seznam druhých mocnin všech prvků seznamu xs.',
    topic: 'seznamy',
    tests: [t('umocniVse [1,2,3]', '[1,4,9]'), t('umocniVse [-4,0]', '[16,0]'), t('umocniVse ([] :: [Int])', '[]')],
    solutions: [rek('umocniVse [] = []\numocniVse (x:xs) = x ^ 2 : umocniVse xs'), gen('umocniVse xs = [x ^ 2 | x <- xs]')],
    hints: ['`^` má vyšší prioritu než `:`, takže `x ^ 2 : umocniVse xs` závorky nepotřebuje.'],
  },
  {
    id: 'u4-nahradzaporne',
    source: null,
    name: 'nahradZaporne',
    signature: 'nahradZaporne xs',
    text: 'Napište funkci nahradZaporne xs, která v seznamu xs nahradí všechny záporné prvky nulou.',
    topic: 'seznamy',
    tests: [t('nahradZaporne [3,-1,0,-7,2]', '[3,0,0,0,2]'), t('nahradZaporne [1,2]', '[1,2]'), t('nahradZaporne ([] :: [Int])', '[]')],
    solutions: [
      rek('nahradZaporne [] = []\nnahradZaporne (x:xs)\n    | x < 0 = 0 : nahradZaporne xs\n    | otherwise = x : nahradZaporne xs'),
      gen('nahradZaporne xs = [if x < 0 then 0 else x | x <- xs]'),
    ],
    hints: ['Prvek se buď nahradí, nebo zůstane, ale vždy se do výsledku něco přidá.'],
  },
  {
    id: 'u4-jenkladne',
    source: null,
    name: 'jenKladne',
    signature: 'jenKladne xs',
    text: 'Napište funkci jenKladne xs, která vrátí seznam jen těch prvků seznamu xs, které jsou kladné.',
    topic: 'seznamy',
    tests: [t('jenKladne [3,-1,0,5,-2]', '[3,5]'), t('jenKladne [-1,-2]', '[]'), t('jenKladne ([] :: [Int])', '[]')],
    solutions: [
      rek('jenKladne [] = []\njenKladne (x:xs)\n    | x > 0 = x : jenKladne xs\n    | otherwise = jenKladne xs'),
      gen('jenKladne xs = [x | x <- xs, x > 0]'),
    ],
    hints: ['Na rozdíl od zdvojLiche se tu prvky, které podmínku nesplní, do výsledku vůbec nedají.', 'Nula není kladná.'],
  },
  {
    id: 'u4-vetsinez',
    source: null,
    name: 'vetsiNez',
    signature: 'vetsiNez k xs',
    text: 'Napište funkci vetsiNez k xs, která vrátí seznam prvků seznamu xs, které jsou větší než k.',
    topic: 'seznamy',
    tests: [t('vetsiNez 3 [1,5,3,8,2]', '[5,8]'), t('vetsiNez 0 [-1,0,1]', '[1]'), t('vetsiNez 10 [1,2]', '[]'), t('vetsiNez 1 ([] :: [Int])', '[]')],
    solutions: [
      rek('vetsiNez _ [] = []\nvetsiNez k (x:xs)\n    | x > k = x : vetsiNez k xs\n    | otherwise = vetsiNez k xs'),
      gen('vetsiNez k xs = [x | x <- xs, x > k]'),
    ],
    hints: ['Při rekurzivním volání nezapomeň předat i `k`.'],
  },
  {
    id: 'u4-smazvsechny',
    source: null,
    name: 'smazVsechny',
    signature: 'smazVsechny a xs',
    text: 'Napište funkci smazVsechny a xs, která ze seznamu xs smaže všechny výskyty prvku a.',
    topic: 'rekurze',
    tests: [t('smazVsechny 2 [1,2,3,2]', '[1,3]'), t('smazVsechny 5 [1,2]', '[1,2]'), t("smazVsechny 'a' \"banan\"", '"bnn"'), t('smazVsechny 1 [1,1]', '[]')],
    solutions: [
      rek('smazVsechny _ [] = []\nsmazVsechny a (x:xs)\n    | a == x = smazVsechny a xs\n    | otherwise = x : smazVsechny a xs'),
      gen('smazVsechny a xs = [x | x <- xs, x /= a]'),
    ],
    hints: ['Když `x == a`, prvek vynech a pokračuj ve zbytku seznamu.'],
  },
  {
    id: 'u4-smazprvni',
    source: null,
    name: 'smazPrvni',
    signature: 'smazPrvni a xs',
    text: 'Napište funkci smazPrvni a xs, která ze seznamu xs smaže první výskyt prvku a. Ostatní výskyty ponechá.',
    topic: 'rekurze',
    tests: [t('smazPrvni 2 [1,2,3,2]', '[1,3,2]'), t('smazPrvni 9 [1,2]', '[1,2]'), t('smazPrvni 1 [1]', '[]'), t('smazPrvni 3 ([] :: [Int])', '[]')],
    solutions: [
      rek('smazPrvni _ [] = []\nsmazPrvni a (x:xs)\n    | a == x = xs\n    | otherwise = x : smazPrvni a xs'),
      { label: 'if-then-else', code: 'smazPrvni _ [] = []\nsmazPrvni a (x:xs) = if a == x then xs else x : smazPrvni a xs' },
    ],
    hints: ['Jakmile najdeš první výskyt, vrať rovnou zbytek `xs`, dál už nehledej.', 'Generátorem seznamu to rozumně nejde, protože ten neví, který výskyt je první.'],
  },
  {
    id: 'u4-zdvojkazdy',
    source: null,
    name: 'zdvojKazdy',
    signature: 'zdvojKazdy xs',
    text: 'Napište funkci zdvojKazdy xs, která každý prvek seznamu xs zopakuje dvakrát za sebou. Například zdvojKazdy [1,2] = [1,1,2,2].',
    topic: 'rekurze',
    tests: [t('zdvojKazdy [1,2]', '[1,1,2,2]'), t('zdvojKazdy "ab"', '"aabb"'), t('zdvojKazdy ([] :: [Int])', '[]')],
    solutions: [rek('zdvojKazdy [] = []\nzdvojKazdy (x:xs) = x : x : zdvojKazdy xs'), gen('zdvojKazdy xs = [y | x <- xs, y <- [x, x]]')],
    hints: ['`:` je asociativní zprava, takže `x : x : zbytek` funguje bez závorek.'],
  },

  // ---- agregace ----
  {
    id: 'u4-soucet',
    source: null,
    name: 'soucet',
    signature: 'soucet xs',
    text: 'Napište rekurzivní funkci soucet xs, která vrátí součet prvků seznamu xs (pro prázdný seznam 0).',
    topic: 'rekurze',
    tests: [t('soucet [1,2,3]', '6'), t('soucet [-5,5]', '0'), t('soucet ([] :: [Int])', '0'), t('soucet [10]', '10')],
    solutions: [rek('soucet [] = 0\nsoucet (x:xs) = x + soucet xs'), { label: 'sum', code: 'soucet xs = sum xs' }],
    hints: ['Součet prázdného seznamu je 0, to je koncová podmínka.'],
  },
  {
    id: 'u4-soucin',
    source: null,
    name: 'soucin',
    signature: 'soucin xs',
    text: 'Napište rekurzivní funkci soucin xs, která vrátí součin prvků seznamu xs (pro prázdný seznam 1).',
    topic: 'rekurze',
    tests: [t('soucin [1,2,3,4]', '24'), t('soucin [5,0,2]', '0'), t('soucin ([] :: [Int])', '1')],
    solutions: [rek('soucin [] = 1\nsoucin (x:xs) = x * soucin xs'), { label: 'product', code: 'soucin xs = product xs' }],
    hints: ['Koncová podmínka je 1, ne 0, jinak by výsledek byl vždy 0.'],
  },
  {
    id: 'u4-delka',
    source: null,
    name: 'delka',
    signature: 'delka xs',
    text: 'Napište rekurzivní funkci delka xs, která vrátí počet prvků seznamu xs (bez použití length).',
    topic: 'rekurze',
    tests: [t('delka [5,6,7]', '3'), t('delka "ahoj"', '4'), t('delka ([] :: [Int])', '0')],
    solutions: [rek('delka [] = 0\ndelka (_:xs) = 1 + delka xs'), gen('delka xs = sum [1 | _ <- xs]')],
    hints: ['Hodnota prvku tě nezajímá, ve vzoru stačí `_`.'],
  },
  {
    id: 'u4-pocetsudych',
    source: null,
    name: 'pocetSudych',
    signature: 'pocetSudych xs',
    text: 'Napište funkci pocetSudych xs, která vrátí počet sudých prvků seznamu xs.',
    topic: 'seznamy',
    tests: [t('pocetSudych [1,2,3,4]', '2'), t('pocetSudych [1,3]', '0'), t('pocetSudych [0,-2]', '2'), t('pocetSudych ([] :: [Int])', '0')],
    solutions: [
      rek('pocetSudych [] = 0\npocetSudych (x:xs)\n    | even x = 1 + pocetSudych xs\n    | otherwise = pocetSudych xs'),
      gen('pocetSudych xs = length [x | x <- xs, even x]'),
    ],
    hints: ['Generátorem vyber sudé prvky a spočítej je funkcí `length`.'],
  },
  {
    id: 'u4-soucetsudych',
    source: null,
    name: 'soucetSudych',
    signature: 'soucetSudych xs',
    text: 'Napište funkci soucetSudych xs, která vrátí součet všech sudých prvků seznamu xs.',
    topic: 'seznamy',
    tests: [t('soucetSudych [1,2,3,4]', '6'), t('soucetSudych [1,3,5]', '0'), t('soucetSudych [-2,10]', '8'), t('soucetSudych ([] :: [Int])', '0')],
    solutions: [
      rek('soucetSudych [] = 0\nsoucetSudych (x:xs)\n    | even x = x + soucetSudych xs\n    | otherwise = soucetSudych xs'),
      gen('soucetSudych xs = sum [x | x <- xs, even x]'),
    ],
    hints: ['Liché prvky přeskoč: rekurze pokračuje bez přičtení.'],
  },
  {
    id: 'u4-pocetvyskytu',
    source: null,
    name: 'pocetVyskytu',
    signature: 'pocetVyskytu a xs',
    text: 'Napište funkci pocetVyskytu a xs, která vrátí, kolikrát se prvek a vyskytuje v seznamu xs.',
    topic: 'seznamy',
    tests: [t('pocetVyskytu 2 [1,2,3,2,2]', '3'), t('pocetVyskytu 9 [1,2]', '0'), t("pocetVyskytu 'a' \"banana\"", '3'), t('pocetVyskytu 1 ([] :: [Int])', '0')],
    solutions: [
      rek('pocetVyskytu _ [] = 0\npocetVyskytu a (x:xs)\n    | a == x = 1 + pocetVyskytu a xs\n    | otherwise = pocetVyskytu a xs'),
      gen('pocetVyskytu a xs = length [x | x <- xs, x == a]'),
    ],
    hints: ['Funguje i pro řetězce, protože řetězec je seznam znaků.'],
  },
  {
    id: 'u4-obsahuje',
    source: null,
    name: 'obsahuje',
    signature: 'obsahuje a xs',
    text: 'Napište funkci obsahuje a xs, která zjistí, jestli seznam xs obsahuje prvek a. Pokud ano, vrátí True, jinak False.',
    topic: 'rekurze',
    tests: [t('obsahuje 3 [1,2,3]', 'True'), t('obsahuje 5 [1,2,3]', 'False'), t("obsahuje 'x' \"ahoj\"", 'False'), t('obsahuje 1 ([] :: [Int])', 'False')],
    solutions: [
      rek('obsahuje _ [] = False\nobsahuje a (x:xs)\n    | a == x = True\n    | otherwise = obsahuje a xs'),
      { label: 'logický výraz', code: 'obsahuje _ [] = False\nobsahuje a (x:xs) = a == x || obsahuje a xs' },
      gen('obsahuje a xs = length [x | x <- xs, x == a] > 0'),
    ],
    hints: ['Pozor na verzi ze zápisků: `if a == x then True else False` bez rekurze kontroluje jen první prvek.', 'Prázdný seznam neobsahuje nic: `obsahuje _ [] = False`.'],
  },
  {
    id: 'u4-nejvetsiprvek',
    source: null,
    name: 'nejvetsiPrvek',
    signature: 'nejvetsiPrvek xs',
    text: 'Napište rekurzivní funkci nejvetsiPrvek xs, která vrátí největší prvek neprázdného seznamu xs (bez použití maximum).',
    topic: 'rekurze',
    tests: [t('nejvetsiPrvek [3,9,2]', '9'), t('nejvetsiPrvek [7]', '7'), t('nejvetsiPrvek [-5,-1,-9]', '-1'), t('nejvetsiPrvek "haskell"', "'s'")],
    solutions: [
      rek('nejvetsiPrvek [x] = x\nnejvetsiPrvek (x:xs) = max x (nejvetsiPrvek xs)'),
      { label: 'stráže', code: 'nejvetsiPrvek [x] = x\nnejvetsiPrvek (x:xs)\n    | x > m = x\n    | otherwise = m\n    where m = nejvetsiPrvek xs' },
    ],
    hints: ['Koncová podmínka je jednoprvkový seznam `[x]`.', 'Největší je buď hlava, nebo největší prvek těla.'],
  },

  // ---- přístup k prvkům ----
  {
    id: 'u4-nty',
    source: null,
    name: 'nty',
    signature: 'nty n xs',
    text: 'Napište funkci nty n xs, která vrátí n-tý prvek seznamu xs (prvky číslujeme od 1).',
    topic: 'rekurze',
    tests: [t('nty 1 [10,20,30]', '10'), t('nty 3 [10,20,30]', '30'), t('nty 2 "abc"', "'b'")],
    solutions: [rek('nty 1 (x:_) = x\nnty n (_:xs) = nty (n - 1) xs'), { label: 'operátor !!', code: 'nty n xs = xs !! (n - 1)' }],
    hints: ['Při každém kroku zahoď hlavu a sniž n o 1, dokud n není 1.'],
  },
  {
    id: 'u4-posledni',
    source: null,
    name: 'posledniPrvek',
    signature: 'posledniPrvek xs',
    text: 'Napište rekurzivní funkci posledniPrvek xs, která vrátí poslední prvek neprázdného seznamu xs.',
    topic: 'rekurze',
    tests: [t('posledniPrvek [1,2,3]', '3'), t('posledniPrvek [7]', '7'), t('posledniPrvek "ahoj"', "'j'")],
    solutions: [rek('posledniPrvek [x] = x\nposledniPrvek (_:xs) = posledniPrvek xs'), { label: 'last', code: 'posledniPrvek xs = last xs' }],
    hints: ['Vzor `[x]` zachytí seznam s jedním prvkem a musí být první.'],
  },
  {
    id: 'u4-predposledni',
    source: null,
    name: 'predposledniPrvek',
    signature: 'predposledniPrvek xs',
    text: 'Napište rekurzivní funkci predposledniPrvek xs, která vrátí předposlední prvek seznamu xs (seznam má aspoň dva prvky).',
    topic: 'rekurze',
    tests: [t('predposledniPrvek [1,2,3]', '2'), t('predposledniPrvek [7,8]', '7'), t('predposledniPrvek "ahoj"', "'o'")],
    solutions: [rek('predposledniPrvek [x,_] = x\npredposledniPrvek (_:xs) = predposledniPrvek xs'), { label: 'reverse', code: 'predposledniPrvek xs = head (tail (reverse xs))' }],
    hints: ['Vzor `[x,_]` je dvouprvkový seznam.'],
  },
  {
    id: 'u4-kazdydruhy',
    source: null,
    name: 'kazdyDruhy',
    signature: 'kazdyDruhy xs',
    text: 'Napište funkci kazdyDruhy xs, která vrátí 1., 3., 5., … prvek seznamu xs.',
    topic: 'rekurze',
    tests: [t('kazdyDruhy [1,2,3,4,5]', '[1,3,5]'), t('kazdyDruhy [1,2]', '[1]'), t('kazdyDruhy "abcdef"', '"ace"'), t('kazdyDruhy ([] :: [Int])', '[]')],
    solutions: [
      rek('kazdyDruhy [] = []\nkazdyDruhy [x] = [x]\nkazdyDruhy (x:_:xs) = x : kazdyDruhy xs'),
      gen('kazdyDruhy xs = [x | (i, x) <- zip [1..] xs, odd i]'),
    ],
    hints: ['Vzor `(x:_:xs)` vezme dva prvky najednou: první si nech, druhý zahoď.', 'Nezapomeň na seznam s jedním prvkem.'],
  },

  // ---- skládání seznamů ----
  {
    id: 'u4-otoc',
    source: null,
    name: 'otoc',
    signature: 'otoc xs',
    text: 'Napište funkci otoc xs, která vrátí seznam xs v obráceném pořadí (bez použití reverse).',
    topic: 'rekurze',
    tests: [t('otoc [1,2,3]', '[3,2,1]'), t('otoc "ahoj"', '"joha"'), t('otoc ([] :: [Int])', '[]')],
    solutions: [
      rek('otoc [] = []\notoc (x:xs) = otoc xs ++ [x]'),
      { label: 'akumulátor', code: "otoc xs = otoc' xs []\n\notoc' [] a = a\notoc' (x:xs) a = otoc' xs (x:a)" },
    ],
    hints: ['Hlavu dej až na konec otočeného těla: `otoc xs ++ [x]`.', 'Rychlejší je pomocná funkce s akumulátorem, do kterého se prvky přidávají na začátek.'],
  },
  {
    id: 'u4-spoj',
    source: null,
    name: 'spoj',
    signature: 'spoj xs ys',
    text: 'Napište rekurzivní funkci spoj xs ys, která za seznam xs připojí seznam ys (bez použití ++).',
    topic: 'rekurze',
    tests: [t('spoj [1,2] [3,4]', '[1,2,3,4]'), t('spoj [] [5]', '[5]'), t('spoj "ab" "cd"', '"abcd"')],
    solutions: [rek('spoj [] ys = ys\nspoj (x:xs) ys = x : spoj xs ys'), { label: 'foldr', code: 'spoj xs ys = foldr (:) ys xs' }],
    hints: ['Rekurze jde jen po prvním seznamu, druhý se vrátí, když první dojde.'],
  },

  // ---- posloupnosti ----
  {
    id: 'u4-sudado',
    source: null,
    name: 'sudaDo',
    signature: 'sudaDo n',
    text: 'Napište funkci sudaDo n, která vrátí seznam všech sudých čísel od 2 do n (včetně, pokud je n sudé).',
    topic: 'generátor seznamu',
    tests: [t('sudaDo 10', '[2,4,6,8,10]'), t('sudaDo 7', '[2,4,6]'), t('sudaDo 1', '[]'), t('sudaDo 2', '[2]')],
    solutions: [
      { label: 'rozsah', code: 'sudaDo n = [2, 4 .. n]' },
      gen('sudaDo n = [x | x <- [1..n], even x]'),
      rek('sudaDo n\n    | n < 2 = []\n    | even n = sudaDo (n - 2) ++ [n]\n    | otherwise = sudaDo (n - 1)'),
    ],
    hints: ['Rozsah s krokem: `[2, 4 .. n]`.'],
  },
  {
    id: 'u4-odpocet',
    source: null,
    name: 'odpocet',
    signature: 'odpocet n',
    text: 'Napište funkci odpocet n, která pro n > 0 vrátí seznam n, n-1, ..., 1. Jinak vrátí prázdný seznam.',
    topic: 'generátor seznamu',
    tests: [t('odpocet 5', '[5,4,3,2,1]'), t('odpocet 1', '[1]'), t('odpocet 0', '[]'), t('odpocet (-2)', '[]')],
    solutions: [
      { label: 'rozsah', code: 'odpocet n = [n, n - 1 .. 1]' },
      rek('odpocet n\n    | n <= 0 = []\n    | otherwise = n : odpocet (n - 1)'),
    ],
    hints: ['`[5..1]` je prázdný seznam, sestupný rozsah potřebuje krok: `[n, n - 1 .. 1]`.'],
  },
  {
    id: 'u4-mocninydvou',
    source: null,
    name: 'mocninyDvou',
    signature: 'mocninyDvou n',
    text: 'Napište funkci mocninyDvou n, která pro n ≥ 0 vrátí seznam 1, 2, 4, ..., 2^n.',
    topic: 'generátor seznamu',
    tests: [t('mocninyDvou 0', '[1]'), t('mocninyDvou 3', '[1,2,4,8]'), t('mocninyDvou 10', '[1,2,4,8,16,32,64,128,256,512,1024]')],
    solutions: [gen('mocninyDvou n = [2 ^ i | i <- [0..n]]'), rek('mocninyDvou 0 = [1]\nmocninyDvou n = mocninyDvou (n - 1) ++ [2 ^ n]')],
    hints: ['Generátor jde přes exponenty 0..n a transformace je `2 ^ i`.'],
  },
  {
    id: 'u4-nasobky',
    source: null,
    name: 'nasobky',
    signature: 'nasobky k n',
    text: 'Napište funkci nasobky k n, která vrátí seznam prvních n násobků čísla k: k, 2k, ..., nk.',
    topic: 'generátor seznamu',
    tests: [t('nasobky 3 4', '[3,6,9,12]'), t('nasobky 5 0', '[]'), t('nasobky (-2) 3', '[-2,-4,-6]'), t('nasobky 7 1', '[7]')],
    solutions: [gen('nasobky k n = [k * i | i <- [1..n]]'), rek('nasobky k n\n    | n <= 0 = []\n    | otherwise = nasobky k (n - 1) ++ [k * n]')],
    hints: ['Rozsah `[k, 2 * k .. n * k]` nefunguje pro k = 0 ani záporné k, generátor ano.'],
  },
  {
    id: 'u4-ctverce',
    source: null,
    name: 'ctverce',
    signature: 'ctverce n',
    text: 'Napište funkci ctverce n, která vrátí seznam druhých mocnin čísel od 1 do n: 1, 4, 9, ..., n².',
    topic: 'generátor seznamu',
    tests: [t('ctverce 4', '[1,4,9,16]'), t('ctverce 1', '[1]'), t('ctverce 0', '[]')],
    solutions: [gen('ctverce n = [x ^ 2 | x <- [1..n]]'), rek('ctverce n\n    | n <= 0 = []\n    | otherwise = ctverce (n - 1) ++ [n ^ 2]')],
    hints: ['Ze zápisků: `[x^2 | x <- [2,4..10]]` dává druhé mocniny sudých čísel.'],
  },
  {
    id: 'u4-delitele',
    source: null,
    name: 'delitele',
    signature: 'delitele n',
    text: 'Napište funkci delitele n, která pro n > 0 vrátí seznam všech kladných dělitelů čísla n.',
    topic: 'generátor seznamu',
    tests: [t('delitele 12', '[1,2,3,4,6,12]'), t('delitele 7', '[1,7]'), t('delitele 1', '[1]')],
    solutions: [
      gen('delitele n = [d | d <- [1..n], n `mod` d == 0]'),
      rek('delitele n = pomoc 1\n    where\n        pomoc d\n            | d > n = []\n            | n `mod` d == 0 = d : pomoc (d + 1)\n            | otherwise = pomoc (d + 1)'),
    ],
    hints: ['Ze zápisků: `[d | d <- [1..c], zbytekPoDeleni c d == 0]`.'],
  },
]

// ------------------------------------------------------------------ generátor

const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)]
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}
const finish = (task) => ({ ...task, id: 'gen-u4-' + hash(task.text + task.name), source: null })
const tests = (exprs) => exprs.map((expr) => ({ expr, expected: null }))

// podmínky na prvek x; `cz` je vedlejší věta za „prvky, …“
function conditions(rng) {
  const k = pick(rng, [2, 3, 5, 10])
  const d = pick(rng, [3, 4, 5])
  const dTxt = { 3: 'třemi', 4: 'čtyřmi', 5: 'pěti' }[d]
  return [
    { id: 'Liche', cz: 'jejichž hodnota je lichá', hs: 'odd x' },
    { id: 'Sude', cz: 'jejichž hodnota je sudá', hs: 'even x' },
    { id: 'Kladne', cz: 'které jsou kladné', hs: 'x > 0' },
    { id: 'Zaporne', cz: 'které jsou záporné', hs: 'x < 0' },
    { id: 'VetsiNez' + k, cz: `které jsou větší než ${k}`, hs: `x > ${k}` },
    { id: 'MensiNez' + k, cz: `které jsou menší než ${k}`, hs: `x < ${k}` },
    { id: 'Delitelne' + d, cz: `které jsou dělitelné ${dTxt}`, hs: `x \`mod\` ${d} == 0` },
  ]
}

const TRANSFORMS = [
  { id: 'zdvoj', cz: 'zdvojnásobí všechny prvky', hs: '2 * x' },
  { id: 'ztroj', cz: 'ztrojnásobí všechny prvky', hs: '3 * x' },
  { id: 'zvys', cz: 'zvýší o 1 všechny prvky', hs: 'x + 1' },
  { id: 'sniz', cz: 'sníží o 1 všechny prvky', hs: 'x - 1' },
  { id: 'umocni', cz: 'umocní na druhou všechny prvky', hs: 'x ^ 2' },
  { id: 'otoc', cz: 'změní znaménko u všech prvků', hs: '-x' },
  { id: 'vynuluj', cz: 'nahradí nulou všechny prvky', hs: '0' },
]

const LISTS = ['[1,2,3,4,5,6]', '[-3,-2,-1,0,1,2,3]', '[10,15,20]', '[7]', '([] :: [Int])']

function genTransform(rng) {
  const c = pick(rng, conditions(rng))
  const tr = pick(rng, TRANSFORMS)
  const name = tr.id + c.id
  return finish({
    name,
    signature: `${name} xs`,
    text: `Napište funkci ${name} xs, která v seznamu xs ${tr.cz}, ${c.cz}. Ostatní prvky ponechá beze změny.`,
    topic: 'seznamy',
    tests: tests(LISTS.map((l) => `${name} ${l}`)),
    solutions: [
      { label: 'rekurze', code: `${name} [] = []\n${name} (x:xs)\n    | ${c.hs} = ${tr.hs} : ${name} xs\n    | otherwise = x : ${name} xs` },
      { label: 'generátor seznamu', code: `${name} xs = [if ${c.hs} then ${tr.hs} else x | x <- xs]` },
    ],
    hints: [
      'Délka výsledku je stejná jako délka xs, mění se jen prvky splňující podmínku.',
      `Generátor: \`[if ${c.hs} then ${tr.hs} else x | x <- xs]\`.`,
    ],
  })
}

function genFilter(rng) {
  const c = pick(rng, conditions(rng))
  const keep = rng() < 0.5
  const name = (keep ? 'jen' : 'bez') + c.id
  const cond = keep ? c.hs : `not (${c.hs})`
  return finish({
    name,
    signature: `${name} xs`,
    text: keep
      ? `Napište funkci ${name} xs, která vrátí seznam jen těch prvků seznamu xs, ${c.cz}.`
      : `Napište funkci ${name} xs, která ze seznamu xs odstraní všechny prvky, ${c.cz}.`,
    topic: 'seznamy',
    tests: tests(LISTS.map((l) => `${name} ${l}`)),
    solutions: [
      { label: 'rekurze', code: `${name} [] = []\n${name} (x:xs)\n    | ${cond} = x : ${name} xs\n    | otherwise = ${name} xs` },
      { label: 'generátor seznamu', code: `${name} xs = [x | x <- xs, ${cond}]` },
    ],
    hints: ['Prvky, které se do výsledku nedostanou, rekurze prostě přeskočí.', 'V generátoru seznamu je podmínka za čárkou: `[x | x <- xs, podmínka]`.'],
  })
}

function genAggregate(rng) {
  const c = pick(rng, conditions(rng))
  const count = rng() < 0.5
  const name = (count ? 'pocet' : 'soucet') + c.id
  return finish({
    name,
    signature: `${name} xs`,
    text: count
      ? `Napište funkci ${name} xs, která vrátí počet prvků seznamu xs, ${c.cz}.`
      : `Napište funkci ${name} xs, která vrátí součet všech prvků seznamu xs, ${c.cz}.`,
    topic: 'seznamy',
    tests: tests(LISTS.map((l) => `${name} ${l}`)),
    solutions: count
      ? [
        { label: 'rekurze', code: `${name} [] = 0\n${name} (x:xs)\n    | ${c.hs} = 1 + ${name} xs\n    | otherwise = ${name} xs` },
        { label: 'generátor seznamu', code: `${name} xs = length [x | x <- xs, ${c.hs}]` },
      ]
      : [
        { label: 'rekurze', code: `${name} [] = 0\n${name} (x:xs)\n    | ${c.hs} = x + ${name} xs\n    | otherwise = ${name} xs` },
        { label: 'generátor seznamu', code: `${name} xs = sum [x | x <- xs, ${c.hs}]` },
      ],
    hints: ['Pro prázdný seznam je výsledek 0.', count ? 'Vyfiltruj prvky a spočítej je funkcí `length`.' : 'Vyfiltruj prvky a sečti je funkcí `sum`.'],
  })
}

// posloupnosti pro a > 0, jinak prázdný seznam
const SEQS = [
  { name: 'zapornaPosloupnost', shape: '-1, -2, ..., -a', f: '-x' },
  { name: 'sudaPosloupnost', shape: '2, 4, ..., 2a', f: '2 * x' },
  { name: 'lichaPosloupnost', shape: '1, 3, 5, ..., 2a - 1', f: '2 * x - 1' },
  { name: 'ctvercovaPosloupnost', shape: '1, 4, 9, ..., a²', f: 'x ^ 2' },
  { name: 'desitkovaPosloupnost', shape: '10, 20, ..., 10a', f: '10 * x' },
  { name: 'mocninyDvojky', shape: '2, 4, 8, ..., 2^a', f: '2 ^ x' },
  { name: 'stridavaPosloupnost', shape: '1, -2, 3, -4, ..., ±a (lichá čísla kladně, sudá záporně)', f: 'if odd x then x else -x' },
  { name: 'kubickaPosloupnost', shape: '1, 8, 27, ..., a³', f: 'x ^ 3' },
]
function genSequence(rng) {
  const s = pick(rng, SEQS)
  const desc = rng() < 0.3
  const name = desc ? s.name + 'Obracene' : s.name
  const shape = desc ? `${s.shape} v obráceném pořadí (od posledního k prvnímu)` : s.shape
  const fa = s.f.replace(/\bx\b/g, 'a')
  return finish({
    name,
    signature: `${name} a`,
    text: `Napište funkci ${name} a, která pro a > 0 vrátí seznam s prvky ve tvaru ${shape}. V opačném případě vrátí prázdný seznam.`,
    topic: 'generátor seznamu',
    tests: tests([5, 1, 0, -3, 3].map((a) => `${name} ${a < 0 ? `(${a})` : a}`)),
    solutions: [
      { label: 'generátor seznamu', code: `${name} a = [${s.f} | x <- ${desc ? '[a, a - 1 .. 1]' : '[1..a]'}]` },
      {
        label: 'rekurze',
        code: desc
          ? `${name} a\n    | a <= 0 = []\n    | otherwise = (${fa}) : ${name} (a - 1)`
          : `${name} a\n    | a <= 0 = []\n    | otherwise = ${name} (a - 1) ++ [${fa}]`,
      },
    ],
    hints: [
      'Pro a ≤ 0 je rozsah `[1..a]` prázdný, takže generátor seznamu vrátí `[]` sám.',
      `Prvek pro pořadí x je \`${s.f}\`.`,
    ],
  })
}

export function generate(rng) {
  const r = rng()
  if (r < 0.45) return genTransform(rng)
  if (r < 0.65) return genFilter(rng)
  if (r < 0.8) return genAggregate(rng)
  return genSequence(rng)
}
