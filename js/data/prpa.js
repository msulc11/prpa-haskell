// Výchozí obsah konzole: funkce ze zápisků (prpa.hs) z cvičení PRPA.
// Upraveno jen tak, aby se to přeložilo v GHC a dalo se to volat z GHCi:
//  - signum / signum' přejmenováno na znamenko / znamenko' (signum je v Prelude a volání by bylo nejednoznačné)
//  - prvek opraven na rekurzivní verzi (původní kontrolovala jen první prvek)
//  - otoc doplněn o chybějící parametr akumulátoru
// Ověřeno: tests/content-ghc.test.js (část prpa).

export const prpaSource = `-- 1. cviceni z prpa

-- 2. cviceni z prpa
{-

if a < (b+c) &&  b < (a+c) &&  c < (a+b) then "lze"  else "nelze"

sqrt (3^2 + 4^2)

zavorky maji prednost (vyhodnocuje se z leva do prava)
1-2-3 -> -4
(1-2)-3 -> -4
1-(2-3) -> 2

u mocneniny je vyhodnocovani z prava do leva
2^3^2 -> 2^(3^2) -> 512
(2^3)^2 -> 64

FUNKCE
-----------------
musi zacinat malym pismenem

mocnina a b = abs a ^ abs b
volani: mocnina 2 3

:l prpa.hs -> pro nacteni souboru
:r  -> pro opetovne nacteni souboru
-}

dvojnasobek a = 2 * a

soucetCtvercu a b = a^2 + b^2

jeMensi a b = if(a < b)then True else False

jeVetsi a b = a>b

mensi a b = if a < b then a else b
vetsi a b = if a > b then a else b

logickySoucet a b = if a == True then True else if b == True then True else False

logickySoucin a b = if a == True then if b == True then True else False else False

--Vzory
logickySoucet2 True True = True
logickySoucet2 True False = True
logickySoucet2 False True = True
logickySoucet2 False False = False

logickySoucet3 False False = False
logickySoucet3 _ _ = True

--logickySoucet (a < 0) (a > 0) spustit v cli pro porovnani

--7.10.

logickySoucin' True True = True
logickySoucin' _ _ = False

absolutniHodnota a = if a < 0 then -a else a

--Stráže - Guarded equations
-- na první řádek napíšu jméno funkce a parametry, na další řádky napíšu podmínky a výsledky, řádek začíná s |
--bacha na odsazování
--otherwise jako chování pro zbytek případů
absolutniHodnota' a
    | a < 0 = -a
    | otherwise = a

-- v zápiscích signum, to ale koliduje s Prelude.signum, proto znamenko
znamenko a = if a < 0 then -1 else if a == 0 then 0 else 1

znamenko' a
    | a < 0 = -1
    | a == 0 = 0
    | otherwise = 1


--Rekurze: snažit se rozdělit složitý problém na více jednodušších, řešených stejným algoritmem
--Snažit se najít koncovou podmínku a tou začít

--podmíněné výrazy - if-then-else
faktorial n = if n == 0 then 1 else n * faktorial (n - 1)

--pomocí vzorů
faktorial' 0 = 1
faktorial' n = n * faktorial' (n - 1)

--pomocí stráží
faktorial'' n
    | n == 0 = 1
    | n < 0 = error "Faktorial neni definovan pro zaporna cisla" -- funkce error vypíše chybovou hlášku a ukončí program
    | otherwise = n * faktorial''(n - 1)

--zbytek po dělení (v haskellu je operátor rem, nebo mod)
zbytekPoDeleni a d
    | d == 0 = error "Deleni nulou neni definovano"
    | a < d = a
    | otherwise = zbytekPoDeleni (a - d) d


--nejmenší společný dělitel
nsd a 0 = a
nsd a b = nsd b (zbytekPoDeleni a b)

-- 4. cvičení 14.10
--Seznamy - seznam je datový typ, který obsahuje libovolný počet prvků stejného typu, prvky jsou odděleny čárkou a celý seznam je uzavřen v hranatých závorkách
--prvky seznamu mohou být libovolného typu, ale všechny prvky musí být stejného typu
-- operátor : připojuje prvek na začátek seznamu  1:[2,3] -> [1,2,3]
-- první je hlava a zbytek seznamu se jmenuje tělo
-- seznam se vytváří od zadu
-- pomocí rozsahu [1..10] -> [1,2,3,4,5,6,7,8,9,10]
-- pomocí posloupnosti [1,3..10] -> [1,3,5,7,9]
-- [x - transformace| x <- [1..6] - generátor, even x - filtrace] -> [2,4,6]  - seznam všech sudých čísel od 1 do 6 -> intenzionální zápis seznamu

-- [[x,y,z] | x <- [1..4], y <- [1..4], z <- [1..4]]
-- [x^2 | x <- [2,4..10]] --> [4,16,36,64,100]
-- [ d | d <- [1..1200600], zbytekPoDeleni 1200600 d == 0 ] -> vypise vsechny delitele cisla 1200600
-- let c = 1200600 in [ d | d <- [1..c], zbytekPoDeleni c d == 0 ]  pouziti let pro zjednoduseni zapisu

prvni (hlava:_) = hlava
druhy (_:d:_) = d
telo (_:telo) = telo
posledniPrvek [x] = x
posledniPrvek (_:telo) = posledniPrvek telo -- funkce se volá rekurzivně, dokud se nedostane na poslední prvek seznamu
predposledniPrvek [x,_] = x
predposledniPrvek (_:telo) = predposledniPrvek telo -- funkce se volá rekurzivně, dokud nebude samotný prvek na konci seznamu
--napiste funkci prvek a xs, ktera zjisti jestli seznam xs obsahuje prvek a, pokud ano vrati True, jinak False
-- (v zápiscích bylo jen: prvek a (x:xs) = if a == x then True else False, to kontroluje jen první prvek)
prvek a [] = False
prvek a (x:xs) = if a == x then True else prvek a xs

--5. cvičení 21.10

--nty prvek z pole

nty 1 (x:_) = x
nty n (_:xs) = nty (n-1) xs

delka [] = 0
delka (_:xs) = 1 + delka xs

--Součet prvku v  seznamu
soucet [] = 0
soucet (x:xs) = x + soucet xs

soucin []  = 1
soucin (x:xs) = x * soucin xs

--smaz prvni ktera ze seznamu xs smaze prvni vyskyt a
smazPrvni _ [] = []
smazPrvni a (x:xs)
    | a == x = xs
    | otherwise = x : smazPrvni a xs

smazVsechny _ [] = []
smazVsechny a (x:xs)
    | a == x = smazVsechny a xs
    | otherwise = x : smazVsechny a xs

-- otočení seznamu s akumulátorem (v zápiscích chyběl parametr a u otoc')
otoc xs = otoc' xs []
otoc' [] a = a
otoc' (x:xs) a = otoc' xs (x:a)

-- pomocí řezu operátoru pro sčítání vytvořte funkci zvysO2, ktera zvyší jeji argument o 2.
zvysO2 = (+2)
umocniNa6 = (^6)
umocni6 a = (6^a)
aplikujBinarniFunkci a b f = (f) a b
--aplikujBinarniFunkci 1 2 (+) -> 3

zvys [] = []
zvys (x:xs) = (x+1) : zvys xs
`
