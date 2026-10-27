# Haskell na písemku (PRPA)

Mobilní trenér na první zápočtovou písemku z Haskellu. Běží celý v prohlížeči, bez serveru.

- **Úloha 1** – hodnota výrazu a pořadí vyhodnocení (závorky)
- **Úloha 2** – najdi a oprav jednu chybu ve funkci
- **Úloha 3** – funkce s podmínkami (if, stráže, vzory)
- **Úloha 4** – funkce nad seznamem (rekurze, generátor seznamu)
- **Cvičná písemka** – nová varianta všech čtyř úloh, opravená po odevzdání
- **Tahák** a **konzole GHCi** s funkcemi ze zápisků

Kód se vyhodnocuje vlastním interpretem podmnožiny Haskellu (`js/hs/`): typová kontrola s typovými třídami,
líné vyhodnocení, výstupy a chybové hlášky jako GHCi. Úlohy jsou ověřené proti GHC 9.12.

## Vývoj

```
python -m http.server 8123        # pak http://127.0.0.1:8123
node tests/engine.test.js         # testy interpretu
node tests/content-shape.test.js  # tvar dat úloh
node tests/content-ghc.test.js    # ověření úloh proti GHC (potřebuje ghc v cestě z docs/CONTRACT.md)
node tools/build-sw.mjs           # před nasazením: seznam souborů pro offline režim
```
