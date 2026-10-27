// Úloha 3 (3 body): napsat funkci s podmínkami (if-then-else, stráže, vzory, jednoduchá rekurze).
// `expected` je přesný výstup GHCi, ověřený skutečným GHC (tests/content-ghc.test.js).

const t = (expr, expected) => ({ expr, expected })

export const tasks = [
  // ---- známé varianty z písemek ----
  {
    id: 'u3-fce3',
    source: 'Písemka, varianta 1',
    name: 'fce3',
    signature: 'fce3 x y',
    text: 'Napište funkci fce3 x y se dvěma parametry x a y, která provede následující výpočet. Pokud bude x menší než y, tak výsledek funkce bude jejich součin. V opačném případě výsledkem funkce bude jejich rozdíl.',
    topic: 'podmínky',
    tests: [t('fce3 2 5', '10'), t('fce3 5 2', '3'), t('fce3 3 3', '0'), t('fce3 (-2) 4', '-8'), t('fce3 0 7', '0'), t('fce3 1 (-1)', '2')],
    solutions: [
      { label: 'if-then-else', code: 'fce3 x y = if x < y then x * y else x - y' },
      { label: 'stráže', code: 'fce3 x y\n    | x < y = x * y\n    | otherwise = x - y' },
    ],
    hints: [
      'Stačí jedna podmínka `x < y`: jedna větev pro ni, druhá pro všechno ostatní.',
      '„V opačném případě“ zahrnuje i rovnost, takže `fce3 3 3` je rozdíl, tedy 0.',
      'fce3 x y = if x < y then x * y else …',
    ],
  },
  {
    id: 'u3-fce4',
    source: 'Písemka, varianta 2',
    name: 'fce4',
    signature: 'fce4 x y',
    text: 'Napište funkci fce4 x y se dvěma parametry x a y, která provede následující výpočet. Pokud bude x menší než 0, tak výsledek funkce bude dvojnásobek y. Pokud x bude rovno 0, výsledkem bude trojnásobek y. Pokud x bude větší než 0, tak výsledkem bude čtyřnásobek y.',
    topic: 'stráže',
    tests: [t('fce4 (-1) 5', '10'), t('fce4 0 5', '15'), t('fce4 3 5', '20'), t('fce4 0 (-2)', '-6'), t('fce4 (-7) 0', '0'), t('fce4 10 (-1)', '-4')],
    solutions: [
      { label: 'stráže', code: 'fce4 x y\n    | x < 0 = 2 * y\n    | x == 0 = 3 * y\n    | otherwise = 4 * y' },
      { label: 'if-then-else', code: 'fce4 x y = if x < 0 then 2 * y else if x == 0 then 3 * y else 4 * y' },
    ],
    hints: [
      'Tři případy: x < 0, x == 0, x > 0. Na to se hodí stráže.',
      'Poslední případ může být `otherwise`, protože zbývá jen x > 0.',
      'fce4 x y\n    | x < 0 = 2 * y\n    | x == 0 = …\n    | otherwise = …',
    ],
  },
  {
    id: 'u3-nejvetsi3',
    source: 'Písemka, varianta 4',
    name: 'nejvetsi3',
    signature: 'nejvetsi3 a b c',
    text: 'Napište funkci nejvetsi3 a b c, která vrátí největší hodnotu ze tří argumentů.',
    topic: 'stráže',
    tests: [t('nejvetsi3 1 2 3', '3'), t('nejvetsi3 3 2 1', '3'), t('nejvetsi3 2 3 1', '3'), t('nejvetsi3 5 5 1', '5'), t('nejvetsi3 (-1) (-2) (-3)', '-1'), t('nejvetsi3 4 4 4', '4')],
    solutions: [
      { label: 'stráže', code: 'nejvetsi3 a b c\n    | a >= b && a >= c = a\n    | b >= c = b\n    | otherwise = c' },
      { label: 'if-then-else', code: 'nejvetsi3 a b c = if a >= b && a >= c then a else if b >= c then b else c' },
      { label: 'max', code: 'nejvetsi3 a b c = max a (max b c)' },
    ],
    hints: [
      '`a` je největší, když je větší nebo rovno oběma zbylým.',
      'Pozor na rovnost: s `>` místo `>=` by `nejvetsi3 5 5 1` vrátilo špatnou hodnotu.',
      'Jde to i bez podmínek pomocí funkce `max`, která bere dva argumenty.',
    ],
  },

  // ---- další ----
  {
    id: 'u3-nejmensi3',
    source: null,
    name: 'nejmensi3',
    signature: 'nejmensi3 a b c',
    text: 'Napište funkci nejmensi3 a b c, která vrátí nejmenší hodnotu ze tří argumentů.',
    topic: 'stráže',
    tests: [t('nejmensi3 1 2 3', '1'), t('nejmensi3 3 2 1', '1'), t('nejmensi3 2 1 3', '1'), t('nejmensi3 4 4 9', '4'), t('nejmensi3 (-1) 0 (-5)', '-5')],
    solutions: [
      { label: 'stráže', code: 'nejmensi3 a b c\n    | a <= b && a <= c = a\n    | b <= c = b\n    | otherwise = c' },
      { label: 'min', code: 'nejmensi3 a b c = min a (min b c)' },
    ],
    hints: ['`a` je nejmenší, když je menší nebo rovno oběma ostatním.', 'Když to není `a`, stačí porovnat `b` a `c`.'],
  },
  {
    id: 'u3-znamenko',
    source: null,
    name: 'znamenko',
    signature: 'znamenko a',
    text: 'Napište funkci znamenko a, která pro záporné číslo vrátí -1, pro nulu 0 a pro kladné číslo 1.',
    topic: 'stráže',
    tests: [t('znamenko (-5)', '-1'), t('znamenko 0', '0'), t('znamenko 7', '1'), t('znamenko (-1)', '-1')],
    solutions: [
      { label: 'stráže', code: 'znamenko a\n    | a < 0 = -1\n    | a == 0 = 0\n    | otherwise = 1' },
      { label: 'if-then-else', code: 'znamenko a = if a < 0 then -1 else if a == 0 then 0 else 1' },
    ],
    hints: ['Tři případy, stráže nebo dvě vnořená `if`.', 'Ve strážích je `-1` bez závorek v pořádku, ale volání s záporným číslem píšeš `znamenko (-5)`.'],
  },
  {
    id: 'u3-absolutni',
    source: null,
    name: 'absolutniHodnota',
    signature: 'absolutniHodnota a',
    text: 'Napište funkci absolutniHodnota a, která vrátí absolutní hodnotu čísla a (bez použití funkce abs).',
    topic: 'podmínky',
    tests: [t('absolutniHodnota (-4)', '4'), t('absolutniHodnota 0', '0'), t('absolutniHodnota 9', '9')],
    solutions: [
      { label: 'if-then-else', code: 'absolutniHodnota a = if a < 0 then -a else a' },
      { label: 'stráže', code: 'absolutniHodnota a\n    | a < 0 = -a\n    | otherwise = a' },
    ],
    hints: ['Záporné číslo otoč znaménkem: `-a` (nebo `negate a`).'],
  },
  {
    id: 'u3-trojuhelnik',
    source: null,
    name: 'trojuhelnik',
    signature: 'trojuhelnik a b c',
    text: 'Napište funkci trojuhelnik a b c, která vrátí řetězec "lze", pokud z úseček délek a, b, c lze sestrojit trojúhelník (každá strana je menší než součet zbylých dvou), jinak vrátí "nelze".',
    topic: 'podmínky',
    tests: [t('trojuhelnik 3 4 5', '"lze"'), t('trojuhelnik 1 2 3', '"nelze"'), t('trojuhelnik 1 1 5', '"nelze"'), t('trojuhelnik 2 2 2', '"lze"'), t('trojuhelnik 10 1 1', '"nelze"')],
    solutions: [
      { label: 'if-then-else', code: 'trojuhelnik a b c = if a < (b + c) && b < (a + c) && c < (a + b) then "lze" else "nelze"' },
      { label: 'stráže', code: 'trojuhelnik a b c\n    | a < b + c && b < a + c && c < a + b = "lze"\n    | otherwise = "nelze"' },
    ],
    hints: ['Tři nerovnosti spoj operátorem `&&`.', 'Řetězce v uvozovkách: `"lze"`.'],
  },
  {
    id: 'u3-prestupny',
    source: null,
    name: 'prestupny',
    signature: 'prestupny r',
    text: 'Napište funkci prestupny r, která vrátí True, pokud je rok r přestupný: je dělitelný 4 a není dělitelný 100, nebo je dělitelný 400. Jinak vrátí False.',
    topic: 'podmínky',
    tests: [t('prestupny 2024', 'True'), t('prestupny 2023', 'False'), t('prestupny 1900', 'False'), t('prestupny 2000', 'True'), t('prestupny 2100', 'False')],
    solutions: [
      { label: 'logický výraz', code: 'prestupny r = (r `mod` 4 == 0 && r `mod` 100 /= 0) || r `mod` 400 == 0' },
      { label: 'stráže', code: 'prestupny r\n    | r `mod` 400 == 0 = True\n    | r `mod` 100 == 0 = False\n    | r `mod` 4 == 0 = True\n    | otherwise = False' },
    ],
    hints: ['Dělitelnost testuj zbytkem: `mod r 4 == 0`.', 'Ve strážích začni nejpřísnější podmínkou (400), pak 100, pak 4.'],
  },
  {
    id: 'u3-znamka',
    source: null,
    name: 'znamka',
    signature: 'znamka body',
    text: 'Napište funkci znamka body, která vrátí známku podle počtu bodů: aspoň 90 bodů je 1, aspoň 75 je 2, aspoň 60 je 3, aspoň 45 je 4, jinak 5.',
    topic: 'stráže',
    tests: [t('znamka 95', '1'), t('znamka 90', '1'), t('znamka 89', '2'), t('znamka 75', '2'), t('znamka 60', '3'), t('znamka 50', '4'), t('znamka 44', '5'), t('znamka 0', '5')],
    solutions: [
      { label: 'stráže', code: 'znamka body\n    | body >= 90 = 1\n    | body >= 75 = 2\n    | body >= 60 = 3\n    | body >= 45 = 4\n    | otherwise = 5' },
      { label: 'if-then-else', code: 'znamka body = if body >= 90 then 1 else if body >= 75 then 2 else if body >= 60 then 3 else if body >= 45 then 4 else 5' },
    ],
    hints: ['Stráže se zkouší shora dolů, takže stačí psát jen dolní hranice od nejvyšší.', 'Hranice patří k lepší známce: 90 bodů je ještě 1.'],
  },
  {
    id: 'u3-pocasi',
    source: null,
    name: 'pocasi',
    signature: 'pocasi t',
    text: 'Napište funkci pocasi t, která pro teplotu t vrátí řetězec "mraz" (t < 0), "zima" (0 až 9), "prijemne" (10 až 24) nebo "horko" (25 a více).',
    topic: 'stráže',
    tests: [t('pocasi (-5)', '"mraz"'), t('pocasi 0', '"zima"'), t('pocasi 9', '"zima"'), t('pocasi 10', '"prijemne"'), t('pocasi 24', '"prijemne"'), t('pocasi 25', '"horko"'), t('pocasi 30', '"horko"')],
    solutions: [
      { label: 'stráže', code: 'pocasi t\n    | t < 0 = "mraz"\n    | t < 10 = "zima"\n    | t < 25 = "prijemne"\n    | otherwise = "horko"' },
      { label: 'if-then-else', code: 'pocasi t = if t < 0 then "mraz" else if t < 10 then "zima" else if t < 25 then "prijemne" else "horko"' },
    ],
    hints: ['Seřaď podmínky od nejnižší teploty, pak stačí jedno porovnání na řádek.'],
  },
  {
    id: 'u3-porovnej',
    source: null,
    name: 'porovnej',
    signature: 'porovnej a b',
    text: 'Napište funkci porovnej a b, která vrátí řetězec "mensi", pokud je a menší než b, "rovno", pokud se rovnají, a "vetsi", pokud je a větší než b.',
    topic: 'stráže',
    tests: [t('porovnej 1 2', '"mensi"'), t('porovnej 2 2', '"rovno"'), t('porovnej 3 2', '"vetsi"'), t('porovnej (-1) (-4)', '"vetsi"')],
    solutions: [
      { label: 'stráže', code: 'porovnej a b\n    | a < b = "mensi"\n    | a == b = "rovno"\n    | otherwise = "vetsi"' },
      { label: 'if-then-else', code: 'porovnej a b = if a < b then "mensi" else if a == b then "rovno" else "vetsi"' },
    ],
    hints: ['Tři případy jako u znaménka, jen porovnáváš a s b.'],
  },
  {
    id: 'u3-jemezi',
    source: null,
    name: 'jeMezi',
    signature: 'jeMezi x d h',
    text: 'Napište funkci jeMezi x d h, která vrátí True, pokud x leží v uzavřeném intervalu od d do h (včetně krajů), jinak False.',
    topic: 'podmínky',
    tests: [t('jeMezi 5 1 10', 'True'), t('jeMezi 1 1 10', 'True'), t('jeMezi 10 1 10', 'True'), t('jeMezi 0 1 10', 'False'), t('jeMezi 11 1 10', 'False')],
    solutions: [
      { label: 'logický výraz', code: 'jeMezi x d h = d <= x && x <= h' },
      { label: 'if-then-else', code: 'jeMezi x d h = if x >= d && x <= h then True else False' },
    ],
    hints: ['Dvě porovnání spojená `&&`. Zápis `d <= x <= h` v Haskellu nefunguje.'],
  },
  {
    id: 'u3-dny',
    source: null,
    name: 'dnyVMesici',
    signature: 'dnyVMesici m',
    text: 'Napište funkci dnyVMesici m, která pro číslo měsíce m (1 až 12) vrátí počet dní v nepřestupném roce: únor 28, duben, červen, září a listopad 30, ostatní 31.',
    topic: 'vzory',
    tests: [t('dnyVMesici 1', '31'), t('dnyVMesici 2', '28'), t('dnyVMesici 4', '30'), t('dnyVMesici 9', '30'), t('dnyVMesici 11', '30'), t('dnyVMesici 12', '31')],
    solutions: [
      { label: 'vzory', code: 'dnyVMesici 2 = 28\ndnyVMesici 4 = 30\ndnyVMesici 6 = 30\ndnyVMesici 9 = 30\ndnyVMesici 11 = 30\ndnyVMesici _ = 31' },
      { label: 'stráže', code: 'dnyVMesici m\n    | m == 2 = 28\n    | m == 4 || m == 6 || m == 9 || m == 11 = 30\n    | otherwise = 31' },
    ],
    hints: ['Vzory se zkouší shora dolů, poslední vzor `_` chytí všechno ostatní.', 'Ve strážích spoj měsíce s 30 dny operátorem `||`.'],
  },
  {
    id: 'u3-delitelne',
    source: null,
    name: 'jeDelitelne',
    signature: 'jeDelitelne a b',
    text: 'Napište funkci jeDelitelne a b, která vrátí True, pokud je a dělitelné b beze zbytku. Pro b rovno 0 vrátí False.',
    topic: 'stráže',
    tests: [t('jeDelitelne 10 5', 'True'), t('jeDelitelne 10 3', 'False'), t('jeDelitelne 0 7', 'True'), t('jeDelitelne 7 0', 'False')],
    solutions: [
      { label: 'stráže', code: 'jeDelitelne a b\n    | b == 0 = False\n    | otherwise = a `mod` b == 0' },
      { label: 'logický výraz', code: 'jeDelitelne a b = b /= 0 && mod a b == 0' },
    ],
    hints: ['Nejdřív ošetři b == 0, jinak `mod a 0` skončí chybou dělení nulou.', '`&&` vyhodnocuje zleva a když je levá strana False, pravou už nepočítá.'],
  },
  {
    id: 'u3-kvadrant',
    source: null,
    name: 'kvadrant',
    signature: 'kvadrant x y',
    text: 'Napište funkci kvadrant x y, která vrátí číslo kvadrantu (1 až 4), ve kterém leží bod [x, y]. Pokud bod leží na některé ose, vrátí 0.',
    topic: 'stráže',
    tests: [t('kvadrant 1 1', '1'), t('kvadrant (-1) 1', '2'), t('kvadrant (-1) (-1)', '3'), t('kvadrant 1 (-1)', '4'), t('kvadrant 0 5', '0'), t('kvadrant 3 0', '0')],
    solutions: [
      { label: 'stráže', code: 'kvadrant x y\n    | x == 0 || y == 0 = 0\n    | x > 0 && y > 0 = 1\n    | x < 0 && y > 0 = 2\n    | x < 0 = 3\n    | otherwise = 4' },
      { label: 'if-then-else', code: 'kvadrant x y = if x == 0 || y == 0 then 0 else if y > 0 then (if x > 0 then 1 else 2) else (if x < 0 then 3 else 4)' },
    ],
    hints: ['Osy vyřeš hned první stráží.', '1. kvadrant: x > 0, y > 0, dál proti směru hodinových ručiček.'],
  },
  {
    id: 'u3-cena',
    source: null,
    name: 'cena',
    signature: 'cena ks',
    text: 'Napište funkci cena ks, která spočítá cenu za ks kusů zboží. Pro méně než 10 kusů stojí kus 100 Kč, pro méně než 50 kusů 90 Kč, jinak 80 Kč.',
    topic: 'stráže',
    tests: [t('cena 1', '100'), t('cena 9', '900'), t('cena 10', '900'), t('cena 49', '4410'), t('cena 50', '4000'), t('cena 0', '0')],
    solutions: [
      { label: 'stráže', code: 'cena ks\n    | ks < 10 = ks * 100\n    | ks < 50 = ks * 90\n    | otherwise = ks * 80' },
      { label: 'if-then-else', code: 'cena ks = if ks < 10 then ks * 100 else if ks < 50 then ks * 90 else ks * 80' },
    ],
    hints: ['Cena za kus se mění podle počtu, výsledek je počet krát cena za kus.'],
  },
  {
    id: 'u3-prostredni',
    source: null,
    name: 'prostredni',
    signature: 'prostredni a b c',
    text: 'Napište funkci prostredni a b c, která vrátí prostřední hodnotu ze tří čísel (tu, která by byla uprostřed po seřazení).',
    topic: 'stráže',
    tests: [t('prostredni 1 2 3', '2'), t('prostredni 3 1 2', '2'), t('prostredni 2 3 1', '2'), t('prostredni 5 5 1', '5'), t('prostredni 1 5 5', '5'), t('prostredni 7 7 7', '7')],
    solutions: [
      { label: 'stráže', code: 'prostredni a b c\n    | (b <= a && a <= c) || (c <= a && a <= b) = a\n    | (a <= b && b <= c) || (c <= b && b <= a) = b\n    | otherwise = c' },
      { label: 'max a min', code: 'prostredni a b c = a + b + c - max a (max b c) - min a (min b c)' },
    ],
    hints: ['`a` je prostřední, když leží mezi `b` a `c` (v jakémkoli pořadí).', 'Trik: součet všech tří minus největší minus nejmenší.'],
  },
  {
    id: 'u3-vylucne',
    source: null,
    name: 'vylucneNebo',
    signature: 'vylucneNebo a b',
    text: 'Napište funkci vylucneNebo a b pro dvě logické hodnoty, která vrátí True právě tehdy, když je pravdivá přesně jedna z nich. Zkuste ji napsat pomocí vzorů.',
    topic: 'vzory',
    tests: [t('vylucneNebo True False', 'True'), t('vylucneNebo False True', 'True'), t('vylucneNebo True True', 'False'), t('vylucneNebo False False', 'False')],
    solutions: [
      { label: 'vzory', code: 'vylucneNebo True False = True\nvylucneNebo False True = True\nvylucneNebo _ _ = False' },
      { label: 'porovnání', code: 'vylucneNebo a b = a /= b' },
    ],
    hints: ['Vypiš případy, kdy je výsledek True, a zbytek pokryj vzorem `_ _`.'],
  },
  {
    id: 'u3-implikace',
    source: null,
    name: 'implikace',
    signature: 'implikace a b',
    text: 'Napište funkci implikace a b, která vrátí False jen v případě, že a je True a b je False. Ve všech ostatních případech vrátí True.',
    topic: 'vzory',
    tests: [t('implikace True True', 'True'), t('implikace True False', 'False'), t('implikace False True', 'True'), t('implikace False False', 'True')],
    solutions: [
      { label: 'vzory', code: 'implikace True False = False\nimplikace _ _ = True' },
      { label: 'logický výraz', code: 'implikace a b = not a || b' },
    ],
    hints: ['Stačí dva řádky: jeden konkrétní případ a jeden obecný s `_`.', 'Pořadí vzorů je důležité, obecný vzor musí být poslední.'],
  },

  // ---- jednoduchá rekurze na číslech ----
  {
    id: 'u3-faktorial',
    source: null,
    name: 'faktorial',
    signature: 'faktorial n',
    text: 'Napište rekurzivní funkci faktorial n, která pro n ≥ 0 vrátí n! (0! = 1).',
    topic: 'rekurze',
    tests: [t('faktorial 0', '1'), t('faktorial 1', '1'), t('faktorial 5', '120'), t('faktorial 10', '3628800')],
    solutions: [
      { label: 'vzory', code: "faktorial 0 = 1\nfaktorial n = n * faktorial (n - 1)" },
      { label: 'if-then-else', code: 'faktorial n = if n == 0 then 1 else n * faktorial (n - 1)' },
      { label: 'stráže', code: 'faktorial n\n    | n == 0 = 1\n    | otherwise = n * faktorial (n - 1)' },
    ],
    hints: ['Koncová podmínka první: `faktorial 0 = 1`.', 'Rekurzivní volání potřebuje závorky: `faktorial (n - 1)`.'],
  },
  {
    id: 'u3-soucetdo',
    source: null,
    name: 'soucetDo',
    signature: 'soucetDo n',
    text: 'Napište rekurzivní funkci soucetDo n, která vrátí součet čísel 1 + 2 + … + n. Pro n ≤ 0 vrátí 0.',
    topic: 'rekurze',
    tests: [t('soucetDo 1', '1'), t('soucetDo 4', '10'), t('soucetDo 100', '5050'), t('soucetDo 0', '0'), t('soucetDo (-3)', '0')],
    solutions: [
      { label: 'stráže', code: 'soucetDo n\n    | n <= 0 = 0\n    | otherwise = n + soucetDo (n - 1)' },
      { label: 'if-then-else', code: 'soucetDo n = if n <= 0 then 0 else n + soucetDo (n - 1)' },
    ],
    hints: ['Koncová podmínka musí zachytit i záporná čísla, jinak rekurze nikdy neskončí: `n <= 0`.'],
  },
  {
    id: 'u3-mocnina',
    source: null,
    name: 'mocnina',
    signature: 'mocnina a n',
    text: 'Napište rekurzivní funkci mocnina a n, která pro n ≥ 0 spočítá a na n-tou bez použití operátoru ^.',
    topic: 'rekurze',
    tests: [t('mocnina 2 10', '1024'), t('mocnina 3 0', '1'), t('mocnina (-2) 3', '-8'), t('mocnina 5 1', '5')],
    solutions: [
      { label: 'vzory', code: 'mocnina _ 0 = 1\nmocnina a n = a * mocnina a (n - 1)' },
      { label: 'stráže', code: 'mocnina a n\n    | n == 0 = 1\n    | otherwise = a * mocnina a (n - 1)' },
    ],
    hints: ['a⁰ = 1 je koncová podmínka.', 'Při rekurzivním volání nezapomeň předat i `a`.'],
  },
  {
    id: 'u3-pocetcifer',
    source: null,
    name: 'pocetCifer',
    signature: 'pocetCifer n',
    text: 'Napište rekurzivní funkci pocetCifer n, která pro n ≥ 0 vrátí počet cifer čísla n.',
    topic: 'rekurze',
    tests: [t('pocetCifer 0', '1'), t('pocetCifer 7', '1'), t('pocetCifer 10', '2'), t('pocetCifer 12345', '5')],
    solutions: [
      { label: 'stráže', code: 'pocetCifer n\n    | n < 10 = 1\n    | otherwise = 1 + pocetCifer (n `div` 10)' },
      { label: 'if-then-else', code: 'pocetCifer n = if n < 10 then 1 else 1 + pocetCifer (div n 10)' },
    ],
    hints: ['Jednociferné číslo (n < 10) má jednu cifru.', 'Celočíselné dělení deseti (`div n 10`) poslední cifru odebere.'],
  },
  {
    id: 'u3-soucetcifer',
    source: null,
    name: 'soucetCifer',
    signature: 'soucetCifer n',
    text: 'Napište rekurzivní funkci soucetCifer n, která pro n ≥ 0 vrátí ciferný součet čísla n.',
    topic: 'rekurze',
    tests: [t('soucetCifer 0', '0'), t('soucetCifer 123', '6'), t('soucetCifer 9999', '36'), t('soucetCifer 5', '5')],
    solutions: [
      { label: 'stráže', code: 'soucetCifer n\n    | n < 10 = n\n    | otherwise = n `mod` 10 + soucetCifer (n `div` 10)' },
      { label: 'vzory', code: 'soucetCifer 0 = 0\nsoucetCifer n = mod n 10 + soucetCifer (div n 10)' },
    ],
    hints: ['Poslední cifra je `mod n 10`, zbytek čísla `div n 10`.'],
  },
  {
    id: 'u3-nsd',
    source: null,
    name: 'nsd',
    signature: 'nsd a b',
    text: 'Napište funkci nsd a b, která Eukleidovým algoritmem spočítá největšího společného dělitele dvou nezáporných čísel: nsd a 0 = a, jinak nsd a b = nsd b (zbytek a po dělení b).',
    topic: 'rekurze',
    tests: [t('nsd 12 18', '6'), t('nsd 17 5', '1'), t('nsd 0 5', '5'), t('nsd 100 75', '25'), t('nsd 7 0', '7')],
    solutions: [
      { label: 'vzory', code: 'nsd a 0 = a\nnsd a b = nsd b (a `mod` b)' },
      { label: 'stráže', code: 'nsd a b\n    | b == 0 = a\n    | otherwise = nsd b (mod a b)' },
    ],
    hints: ['Koncová podmínka je druhý argument rovný nule.'],
  },
]

// ------------------------------------------------------------------ generátor

const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)]
function pickDistinct(rng, xs, n) {
  const pool = xs.slice(), out = []
  while (out.length < n) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return out
}
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}
const arg = (n) => (n < 0 ? `(${n})` : String(n))
const testsOf = (name, pairs) => pairs.map((p) => ({ expr: [name, ...p.map(arg)].join(' '), expected: null }))
const finish = (task) => ({ ...task, id: 'gen-u3-' + hash(task.text), source: null })

// šablona ve stylu fce3: jedna podmínka x vs y, dvě větve
const CMP = [
  { cz: 'x menší než y', hs: 'x < y' },
  { cz: 'x větší než y', hs: 'x > y' },
  { cz: 'x menší nebo rovno y', hs: 'x <= y' },
  { cz: 'x větší nebo rovno y', hs: 'x >= y' },
  { cz: 'x rovno y', hs: 'x == y' },
]
const RES2 = [
  { cz: 'jejich součin', hs: 'x * y' },
  { cz: 'jejich rozdíl', hs: 'x - y' },
  { cz: 'jejich součet', hs: 'x + y' },
  { cz: 'dvojnásobek x', hs: '2 * x' },
  { cz: 'trojnásobek y', hs: '3 * y' },
  { cz: 'druhá mocnina y', hs: 'y ^ 2' },
  { cz: 'rozdíl y a x', hs: 'y - x' },
  { cz: 'větší z obou čísel', hs: 'max x y' },
  { cz: 'nula', hs: '0' },
]
function genTwoWay(rng) {
  const name = 'fce' + (1 + Math.floor(rng() * 9))
  const c = pick(rng, CMP)
  const [r1, r2] = pickDistinct(rng, RES2, 2)
  return finish({
    name,
    signature: `${name} x y`,
    text: `Napište funkci ${name} x y se dvěma parametry x a y, která provede následující výpočet. Pokud bude ${c.cz}, tak výsledek funkce bude ${r1.cz}. V opačném případě výsledkem funkce bude ${r2.cz}.`,
    topic: 'podmínky',
    tests: testsOf(name, [[2, 5], [5, 2], [3, 3], [-2, 4], [0, -3], [4, -4]]),
    solutions: [
      { label: 'if-then-else', code: `${name} x y = if ${c.hs} then ${r1.hs} else ${r2.hs}` },
      { label: 'stráže', code: `${name} x y\n    | ${c.hs} = ${r1.hs}\n    | otherwise = ${r2.hs}` },
    ],
    hints: [
      `Jedna podmínka \`${c.hs}\` a jedna větev pro všechno ostatní.`,
      `${name} x y = if ${c.hs} then … else …`,
    ],
  })
}

// šablona ve stylu fce4: x vs hranice (menší / rovno / větší), výsledek z y
const RES3 = [
  { cz: 'dvojnásobek y', hs: '2 * y' },
  { cz: 'trojnásobek y', hs: '3 * y' },
  { cz: 'čtyřnásobek y', hs: '4 * y' },
  { cz: 'druhá mocnina y', hs: 'y ^ 2' },
  { cz: 'opačná hodnota y', hs: '-y' },
  { cz: 'y zvětšené o 1', hs: 'y + 1' },
  { cz: 'y zmenšené o 1', hs: 'y - 1' },
  { cz: 'přímo hodnota y', hs: 'y' },
  { cz: 'nula', hs: '0' },
]
function genThreeWay(rng) {
  const name = 'fce' + (1 + Math.floor(rng() * 9))
  const k = pick(rng, [0, 0, 0, 5, 10])
  const [r1, r2, r3] = pickDistinct(rng, RES3, 3)
  return finish({
    name,
    signature: `${name} x y`,
    text: `Napište funkci ${name} x y se dvěma parametry x a y, která provede následující výpočet. Pokud bude x menší než ${k}, tak výsledek funkce bude ${r1.cz}. Pokud x bude rovno ${k}, výsledkem bude ${r2.cz}. Pokud x bude větší než ${k}, tak výsledkem bude ${r3.cz}.`,
    topic: 'stráže',
    tests: testsOf(name, [[k - 3, 5], [k, 5], [k + 4, 5], [k, -2], [k - 1, -2], [k + 1, 0]]),
    solutions: [
      { label: 'stráže', code: `${name} x y\n    | x < ${k} = ${r1.hs}\n    | x == ${k} = ${r2.hs}\n    | otherwise = ${r3.hs}` },
      { label: 'if-then-else', code: `${name} x y = if x < ${k} then ${r1.hs} else if x == ${k} then ${r2.hs} else ${r3.hs}` },
    ],
    hints: [
      `Tři případy podle porovnání x s ${k}: stráže \`x < ${k}\`, \`x == ${k}\`, \`otherwise\`.`,
      'Záporný výsledek jako `-y` je ve stráži v pořádku.',
    ],
  })
}

// tři argumenty
const THREE = [
  {
    name: 'nejvetsi3', what: 'největší hodnotu ze tří argumentů',
    sols: [
      'nejvetsi3 a b c\n    | a >= b && a >= c = a\n    | b >= c = b\n    | otherwise = c',
      'nejvetsi3 a b c = max a (max b c)',
    ],
  },
  {
    name: 'nejmensi3', what: 'nejmenší hodnotu ze tří argumentů',
    sols: [
      'nejmensi3 a b c\n    | a <= b && a <= c = a\n    | b <= c = b\n    | otherwise = c',
      'nejmensi3 a b c = min a (min b c)',
    ],
  },
  {
    name: 'rozpeti3', what: 'rozdíl mezi největší a nejmenší hodnotou ze tří argumentů',
    sols: [
      'rozpeti3 a b c = max a (max b c) - min a (min b c)',
      'rozpeti3 a b c\n    | a >= b && a >= c = a - min b c\n    | b >= c = b - min a c\n    | otherwise = c - min a b',
    ],
  },
  {
    name: 'soucetDvouVetsich', what: 'součet dvou největších hodnot ze tří argumentů',
    sols: [
      'soucetDvouVetsich a b c = a + b + c - min a (min b c)',
      'soucetDvouVetsich a b c\n    | a <= b && a <= c = b + c\n    | b <= c = a + c\n    | otherwise = a + b',
    ],
  },
  {
    name: 'pocetKladnych3', what: 'kolik ze tří argumentů je kladných (větších než 0)',
    sols: [
      'pocetKladnych3 a b c = k a + k b + k c\n    where k x = if x > 0 then 1 else 0',
      'pocetKladnych3 a b c = length [x | x <- [a, b, c], x > 0]',
    ],
  },
]
function genThreeArgs(rng) {
  const v = pick(rng, THREE)
  return finish({
    name: v.name,
    signature: `${v.name} a b c`,
    text: `Napište funkci ${v.name} a b c, která vrátí ${v.what}.`,
    topic: 'stráže',
    tests: testsOf(v.name, [[1, 2, 3], [3, 2, 1], [2, 3, 1], [5, 5, 1], [-1, -2, -3], [4, 4, 4], [0, -7, 2]]),
    solutions: v.sols.map((code, i) => ({ label: i === 0 ? 'řešení A' : 'řešení B', code })),
    hints: ['Pozor na shodné hodnoty, testy obsahují i `5 5 1` a `4 4 4`.'],
  })
}

// rozdělení do pásem, výsledkem je řetězec
const BANDS = [
  ['male', 'stredni', 'velke'],
  ['nizka', 'stredni', 'vysoka'],
  ['malo', 'akorat', 'moc'],
]
function genBands(rng) {
  const [w1, w2, w3] = pick(rng, BANDS)
  const a = pick(rng, [0, 5, 10, 18])
  const b = a + pick(rng, [5, 10, 20])
  const name = pick(rng, ['kategorie', 'pasmo', 'zarad'])
  return finish({
    name,
    signature: `${name} x`,
    text: `Napište funkci ${name} x, která vrátí řetězec "${w1}" pro x menší než ${a}, "${w2}" pro x od ${a} do ${b - 1} (včetně) a "${w3}" pro x od ${b} výš.`,
    topic: 'stráže',
    tests: testsOf(name, [[a - 1], [a], [b - 1], [b], [b + 7], [a - 10]]),
    solutions: [
      { label: 'stráže', code: `${name} x\n    | x < ${a} = "${w1}"\n    | x < ${b} = "${w2}"\n    | otherwise = "${w3}"` },
      { label: 'if-then-else', code: `${name} x = if x < ${a} then "${w1}" else if x < ${b} then "${w2}" else "${w3}"` },
    ],
    hints: ['Stráže jdou shora dolů, takže druhá stráž už ví, že x není menší než ' + a + '.'],
  })
}

export function generate(rng) {
  const r = rng()
  if (r < 0.35) return genTwoWay(rng)
  if (r < 0.7) return genThreeWay(rng)
  if (r < 0.85) return genThreeArgs(rng)
  return genBands(rng)
}
