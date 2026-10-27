// Úloha 1 (2 body): určit výslednou hodnotu výrazu a doplnit všechny závorky tak,
// aby určovaly pořadí kroků výpočtu. `value` je výstup GHCi, `parens` plně uzávorkovaný
// tvar (vnější úroveň bez závorek). Obojí ověřené proti GHC (tests/content-ghc.test.js).

const f = (id, expr, value, parens, level, source = null, note = '') => ({ id, expr, value, parens, level, source, note })

export const fixed = [
  // písemky
  f('u1-v1', '1 + 2 ^ 3 * 4', '33', '1 + ((2 ^ 3) * 4)', 1, 'Písemka, varianta 1', 'Nejdřív mocnina (priorita 8), pak násobení (7), nakonec sčítání (6).'),
  f('u1-v4', '3 * 2 < 4', 'False', '(3 * 2) < 4', 1, 'Písemka, varianta 4', 'Aritmetika má vyšší prioritu než porovnání, výsledek je Bool.'),
  f('u1-v2', '(*) 3 (2 + 4)', '18', '(*) 3 (2 + 4)', 1, 'Písemka, varianta 2', 'Operátor v závorkách je obyčejná funkce dvou argumentů: `(*) 3 6`.'),

  // zápisky
  f('u1-z1', '2 ^ 3 ^ 2', '512', '2 ^ (3 ^ 2)', 1, 'Zápisky', 'Mocnina je asociativní zprava.'),
  f('u1-z2', '1 - 2 - 3', '-4', '(1 - 2) - 3', 1, 'Zápisky', 'Odčítání je asociativní zleva.'),
  f('u1-z3', '1 - (2 - 3)', '2', '1 - (2 - 3)', 1, 'Zápisky', 'Závorky mají přednost.'),
  f('u1-z4', 'sqrt (3 ^ 2 + 4 ^ 2)', '5.0', 'sqrt ((3 ^ 2) + (4 ^ 2))', 2, 'Zápisky', '`sqrt` vrací desetinné číslo, proto `5.0`.'),

  // asociativita
  f('u1-a1', '20 - 6 - 4 + 1', '11', '((20 - 6) - 4) + 1', 1, null, '`+` a `-` mají stejnou prioritu a jsou asociativní zleva.'),
  f('u1-a2', '100 / 10 / 2', '5.0', '(100 / 10) / 2', 1, null, '`/` je asociativní zleva a dává desetinné číslo.'),
  f('u1-a3', '2 * 3 `mod` 4', '2', '(2 * 3) `mod` 4', 2, null, '`*` i `mod` mají prioritu 7 a asociativitu zleva.'),
  f('u1-a4', '1 : 2 : [3]', '[1,2,3]', '1 : (2 : [3])', 2, null, '`:` je asociativní zprava, seznam se staví od konce.'),
  f('u1-a5', '[1, 2] ++ [3] ++ [4]', '[1,2,3,4]', '[1, 2] ++ ([3] ++ [4])', 2, null, '`++` je také asociativní zprava.'),

  // priority aritmetiky
  f('u1-p1', '2 * 3 ^ 2 + 1', '19', '(2 * (3 ^ 2)) + 1', 1),
  f('u1-p2', '17 `div` 5 * 2', '6', '(17 `div` 5) * 2', 2, null, '`div` v obrácených apostrofech má prioritu 7 jako `*`.'),
  f('u1-p3', '2 + 17 `mod` 5 * 3', '8', '2 + ((17 `mod` 5) * 3)', 2),
  f('u1-p4', '3 + 4 `div` 2 - 1', '4', '(3 + (4 `div` 2)) - 1', 2),
  f('u1-p5', '10 - 2 - 3 * 2 ^ 2', '-4', '(10 - 2) - (3 * (2 ^ 2))', 2),
  f('u1-p6', '2 ^ 2 ^ 3 `div` 16', '16', '(2 ^ (2 ^ 3)) `div` 16', 3),

  // porovnání a logika
  f('u1-b1', '1 + 2 * 3 == 7', 'True', '(1 + (2 * 3)) == 7', 1),
  f('u1-b2', '3 < 4 && 2 + 2 == 5', 'False', '(3 < 4) && ((2 + 2) == 5)', 2, null, '`&&` má nižší prioritu (3) než porovnání (4).'),
  f('u1-b3', 'True || False && False', 'True', 'True || (False && False)', 2, null, '`&&` (3) váže silněji než `||` (2).'),
  f('u1-b4', '5 * 4 `mod` 3 == 2 || False', 'True', '(((5 * 4) `mod` 3) == 2) || False', 3),

  // aplikace funkce
  f('u1-f1', 'max 2 3 * 4', '12', '(max 2 3) * 4', 1, null, 'Aplikace funkce váže nejsilněji ze všeho.'),
  f('u1-f2', 'min 10 4 + max 1 2 ^ 2', '8', '(min 10 4) + ((max 1 2) ^ 2)', 2),
  f('u1-f3', 'div 20 3 - 2 * 2', '2', '(div 20 3) - (2 * 2)', 2, null, 'Prefixový `div` je obyčejné volání funkce.'),
  f('u1-f4', 'not True || 5 > 3 * 2', 'False', '(not True) || (5 > (3 * 2))', 2),
  f('u1-f5', 'even 4 && odd 3 || 1 > 2', 'True', '((even 4) && (odd 3)) || (1 > 2)', 3),
  f('u1-f6', 'negate 3 + 4 * 2', '5', '(negate 3) + (4 * 2)', 2),
  f('u1-f7', 'abs (-3) * 2 ^ 2', '12', '(abs (-3)) * (2 ^ 2)', 2, null, 'Záporné číslo jako argument funkce musí být v závorkách.'),

  // prefixové operátory a řezy
  f('u1-r1', '(+) 2 3 * 4', '20', '((+) 2 3) * 4', 2),
  f('u1-r2', '(*) 2 3 + (-) 10 4', '12', '((*) 2 3) + ((-) 10 4)', 2, null, '`(-) 10 4` je 10 - 4.'),
  f('u1-r3', '(subtract 3) 10', '7', '(subtract 3) 10', 2, null, '`subtract 3` odečte 3 od argumentu. `(-3)` by bylo číslo minus tři, ne řez.'),
  f('u1-r4', '(`div` 2) 9', '4', '(`div` 2) 9', 2, null, 'Pravý řez s div: doplněný je druhý argument, takže je to `div 9 2`.'),
  f('u1-r5', '(2 ^) 3 * 2', '16', '((2 ^) 3) * 2', 3, null, 'Levý řez: `(2 ^) 3` je `2 ^ 3`.'),
  f('u1-r6', '(^ 2) 5 - 1', '24', '((^ 2) 5) - 1', 3, null, 'Pravý řez: `(^ 2) 5` je `5 ^ 2`.'),

  // unární minus
  f('u1-n1', '- 2 ^ 2', '-4', '-(2 ^ 2)', 3, null, 'Unární minus má prioritu 6 jako odčítání, mocnina se spočítá dřív.'),
  f('u1-n2', '- 2 + 3', '1', '(-2) + 3', 3),
]

// ------------------------------------------------------------------ generátor
//
// Většina výrazů vzniká jako v písemce: řada operandů a operátorů bez závorek
// (`1 + 2 ^ 3 * 4`). Strom se z ní sestaví podle fixit GHC (algoritmus z Haskell Reportu),
// zkontrolují se typy (čísla vs. Bool) a teprve pak se doplní operandy. Část výrazů
// (úroveň 2 a 3) vzniká jako strom s funkcemi, prefixovými operátory a řezy (`(*) 3 (2 + 4)`).

const FIX = {
  '^': [8, 'r'], '*': [7, 'l'], div: [7, 'l'], mod: [7, 'l'], '+': [6, 'l'], '-': [6, 'l'],
  '<': [4, 'n'], '>': [4, 'n'], '<=': [4, 'n'], '>=': [4, 'n'], '==': [4, 'n'], '/=': [4, 'n'],
  '&&': [3, 'r'], '||': [2, 'r'],
}
const ARITH1 = ['+', '-', '*', '^']
const ARITH2 = ['+', '-', '*', '^', 'div', 'mod']
const CMP = ['<', '>', '<=', '>=', '==', '/=']
const LOGIC = ['&&', '||']
const typeOfOp = (op) => (LOGIC.includes(op) ? ['bool', 'bool'] : CMP.includes(op) ? ['num', 'bool'] : ['num', 'num']) // [vstup, výstup]
const BT = new Set(['div', 'mod'])
const opTxt = (op) => (BT.has(op) ? '`' + op + '`' : op)

const lit = (v) => ({ k: 'lit', v: BigInt(v) })
const blit = (v) => ({ k: 'blit', v })
const bin = (op, l, r) => ({ k: 'bin', op, l, r })
const app = (fn, args) => ({ k: 'app', fn, args })
const pre = (op, l, r) => ({ k: 'pre', op, l, r }) // (op) l r
const sec = (op, side, kv, a) => ({ k: 'sec', op, side, kv: BigInt(kv), a }) // (k op) a | (op k) a
const neg = (a) => ({ k: 'neg', a })

class Bad extends Error {}
const LIMIT = 100000n

function binop(op, a, b) {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '^': if (b < 0n || b > 12n) throw new Bad(); return a ** b
    case 'div': case 'mod': {
      if (b <= 0n || a < 0n) throw new Bad()
      return op === 'div' ? a / b : a % b
    }
    case '<': return a < b
    case '>': return a > b
    case '<=': return a <= b
    case '>=': return a >= b
    case '==': return a === b
    case '/=': return a !== b
    case '&&': return a && b
    case '||': return a || b
  }
  throw new Error(op)
}
function ev(n) {
  let v
  switch (n.k) {
    case 'lit': case 'blit': v = n.v; break
    case 'bin': v = binop(n.op, ev(n.l), ev(n.r)); break
    case 'pre': v = binop(n.op, ev(n.l), ev(n.r)); break
    case 'sec': v = n.side === 'left' ? binop(n.op, n.kv, ev(n.a)) : binop(n.op, ev(n.a), n.kv); break
    case 'neg': v = -ev(n.a); break
    case 'app': {
      const a = n.args.map(ev)
      switch (n.fn) {
        case 'max': v = a[0] > a[1] ? a[0] : a[1]; break
        case 'min': v = a[0] < a[1] ? a[0] : a[1]; break
        case 'div': case 'mod': v = binop(n.fn, a[0], a[1]); break
        case 'negate': v = -a[0]; break
        case 'abs': v = a[0] < 0n ? -a[0] : a[0]; break
        case 'not': v = !a[0]; break
        case 'even': v = a[0] % 2n === 0n; break
        case 'odd': v = a[0] % 2n !== 0n; break
        default: throw new Error(n.fn)
      }
    }
  }
  if (typeof v === 'bigint' && (v > LIMIT || v < -LIMIT)) throw new Bad()
  return v
}

// tisk s minimem závorek
const precOf = (n) => (n.k === 'bin' ? FIX[n.op][0] : n.k === 'neg' ? 6 : 10)
function show(n) {
  switch (n.k) {
    case 'lit': return n.v < 0n ? `(${n.v})` : String(n.v)
    case 'blit': return n.v ? 'True' : 'False'
    case 'bin': {
      const [p, a] = FIX[n.op]
      const L = needParens(n.l, p, a, 'l') ? `(${show(n.l)})` : show(n.l)
      const R = needParens(n.r, p, a, 'r') ? `(${show(n.r)})` : show(n.r)
      return `${L} ${opTxt(n.op)} ${R}`
    }
    case 'app': return [n.fn, ...n.args.map(arg)].join(' ')
    case 'pre': return `(${n.op}) ${arg(n.l)} ${arg(n.r)}`
    case 'sec': {
      const s = n.side === 'left' ? `(${n.kv} ${opTxt(n.op)})` : n.op === '-' ? `(subtract ${n.kv})` : `(${opTxt(n.op)} ${n.kv})`
      return `${s} ${arg(n.a)}`
    }
    case 'neg': return `- ${precOf(n.a) >= 7 ? show(n.a) : `(${show(n.a)})`}`
  }
}
const arg = (n) => (n.k === 'lit' || n.k === 'blit' ? show(n) : `(${show(n)})`)
function needParens(child, p, a, side) {
  // negace se generuje jen na začátku celého výrazu (kořen nebo jeho levý operand)
  if (child.k === 'neg') return !(side === 'l' && (p < 6 || (p === 6 && a === 'l')))
  const cp = precOf(child)
  if (cp > p) return false
  if (cp < p) return true
  const ca = FIX[child.op][1]
  if (a === 'n' || ca !== a) return true
  return (a === 'l' && side === 'r') || (a === 'r' && side === 'l')
}

const rint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))
const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)]
const split = (rng, n) => { const l = rint(rng, 0, n); return [l, n - l] }

// ---- výrazy bez závorek: řada operátorů -> strom podle fixit -> typy -> operandy

function resolveOps(ops) {
  let q = 0
  const hole = () => ({ k: 'hole' })
  function parse1(p1, a1, e1) {
    while (q < ops.length) {
      const [p2, a2] = FIX[ops[q]]
      if (p1 === p2 && (a1 !== a2 || a1 === 'n')) throw new Bad() // např. a < b < c
      if (p1 > p2 || (p1 === p2 && a1 === 'l')) return e1
      const op = ops[q++]
      e1 = bin(op, e1, parse1(p2, a2, hole()))
    }
    return e1
  }
  return parse1(-1, 'n', hole())
}

// doplní typ, který má mít každá díra; vrací false, když se typy operátorů nesnesou
function typeHoles(n, want, parentOp, side) {
  if (n.k === 'hole') { Object.assign(n, { want, parentOp, side }); return true }
  const [inT, outT] = typeOfOp(n.op)
  if (want && want !== outT) return false
  return typeHoles(n.l, inT, n.op, 'l') && typeHoles(n.r, inT, n.op, 'r')
}

function numAtom(rng, level, parentOp, side) {
  if (parentOp === '^' && side === 'r') return lit(pick(rng, [2, 2, 3, 3, 0, 1]))
  if (parentOp === '^' && side === 'l') return lit(rint(rng, 1, 5))
  if (BT.has(parentOp) && side === 'r') return lit(rint(rng, 2, 5))
  if (BT.has(parentOp) && side === 'l') return lit(rint(rng, 5, 20))
  if (level >= 2 && rng() < 0.18) {
    const f = pick(rng, ['max', 'min', 'div', 'mod', 'negate', 'abs'])
    if (f === 'negate') return app(f, [lit(rint(rng, 1, 9))])
    if (f === 'abs') return app(f, [lit(-rint(rng, 1, 9))])
    if (f === 'div' || f === 'mod') return app(f, [lit(rint(rng, 5, 20)), lit(rint(rng, 2, 5))])
    return app(f, [lit(rint(rng, 1, 9)), lit(rint(rng, 1, 9))])
  }
  return lit(rint(rng, 1, 9))
}
function boolAtom(rng) {
  const r = rng()
  if (r < 0.25) return blit(rng() < 0.5)
  if (r < 0.4) return app('not', [blit(rng() < 0.5)])
  return app(pick(rng, ['even', 'odd']), [lit(rint(rng, 1, 12))])
}
function fill(n, rng, level) {
  if (n.k === 'hole') return n.want === 'bool' ? boolAtom(rng) : numAtom(rng, level, n.parentOp, n.side)
  return { ...n, l: fill(n.l, rng, level), r: fill(n.r, rng, level) }
}

function flatOps(rng, level) {
  if (level === 1) {
    if (rng() < 0.25) return rng() < 0.5 ? [pick(rng, ARITH1), pick(rng, CMP)] : [pick(rng, CMP), pick(rng, ARITH1)]
    return [pick(rng, ARITH1), pick(rng, ARITH1)]
  }
  if (level === 2) {
    const ops = [pick(rng, ARITH2), pick(rng, ARITH2), pick(rng, ARITH2)]
    if (rng() < 0.35) ops[rint(rng, 0, 2)] = pick(rng, CMP)
    return ops
  }
  return Array.from({ length: rint(rng, 4, 6) }, () => {
    const r = rng()
    return r < 0.5 ? pick(rng, ARITH2) : r < 0.78 ? pick(rng, CMP) : pick(rng, LOGIC)
  })
}

function flatCandidate(rng, level) {
  let shape
  try { shape = resolveOps(flatOps(rng, level)) } catch (e) { if (e instanceof Bad) return null; throw e }
  if (!typeHoles(shape, null, null, null)) return null
  for (let i = 0; i < 12; i++) {
    const tree = fill(shape, rng, level)
    try { ev(tree); return tree } catch (e) { if (!(e instanceof Bad)) throw e }
  }
  return null
}

// ---- výrazy se závorkami, funkcemi, prefixovými operátory a řezy

function genNum(rng, n, lvl) {
  if (n <= 0) return lit(rint(rng, 1, rng() < 0.8 ? 9 : 20))
  const r = rng()
  if (lvl >= 2 && r < 0.12) {
    const [a, b] = split(rng, n - 1)
    return app(pick(rng, ['max', 'min', 'div', 'mod']), [genNum(rng, a, lvl), genNum(rng, b, lvl)])
  }
  if (lvl >= 2 && r < 0.18) return app(pick(rng, ['negate', 'abs']), [genNum(rng, n - 1, lvl)])
  if (lvl >= 2 && r < 0.3) {
    const [a, b] = split(rng, n - 1)
    return pre(pick(rng, ['+', '-', '*']), genNum(rng, Math.min(a, 1), 1), genNum(rng, Math.min(b, 1), 1))
  }
  if (lvl >= 3 && r < 0.4) {
    const op = pick(rng, ['^', '-', '*', 'div', '+'])
    const side = op === '^' ? pick(rng, ['left', 'right']) : op === '-' || op === 'div' ? 'right' : pick(rng, ['left', 'right'])
    const kv = op === '^' && side === 'right' ? rint(rng, 2, 3) : rint(rng, 2, 5)
    return sec(op, side, kv, genNum(rng, Math.min(n - 1, 1), 1))
  }
  const ops = lvl === 1 ? ['+', '-', '*', '^'] : ['+', '-', '*', '^', 'div', 'mod']
  const op = pick(rng, ops)
  if (op === '^') return bin('^', genNum(rng, n - 1, lvl), lit(rint(rng, 2, 3)))
  const [a, b] = split(rng, n - 1)
  return bin(op, genNum(rng, a, lvl), genNum(rng, b, lvl))
}

function treeCandidate(rng, level) {
  const r = rng()
  if (level === 3 && r < 0.25) return neg(genNum(rng, rint(rng, 1, 2), 1))
  if (level === 3 && r < 0.45) return bin(pick(rng, ['+', '-']), neg(genNum(rng, rint(rng, 0, 1), 1)), genNum(rng, rint(rng, 1, 2), 2))
  const tree = genNum(rng, level === 2 ? rint(rng, 2, 3) : rint(rng, 3, 4), level)
  if (rng() < 0.3) return bin(pick(rng, CMP), tree, lit(rint(rng, 1, 30)))
  return tree
}

function countOps(n) {
  switch (n.k) {
    case 'lit': case 'blit': return 0
    case 'bin': case 'pre': return 1 + countOps(n.l) + countOps(n.r)
    case 'sec': case 'neg': return 1 + countOps(n.a)
    case 'app': return 1 + n.args.reduce((s, a) => s + countOps(a), 0)
  }
}
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

// Náhodný dobře typovaný výraz. rng: () => [0,1).
// level 1: dvě operace (+ - * ^ a porovnání), 2: tři operace vč. `div`/`mod` a funkcí,
// 3: čtyři až šest operací vč. && ||, řezů, prefixových operátorů a unárního minus.
export function generate(rng) {
  const level = rint(rng, 1, 3)
  for (let attempt = 0; attempt < 400; attempt++) {
    const useTree = level === 2 ? rng() < 0.25 : level === 3 ? rng() < 0.3 : false
    const tree = useTree ? treeCandidate(rng, level) : flatCandidate(rng, level)
    if (!tree || tree.k === 'lit') continue
    if (tree.k === 'neg' && precOf(tree.a) < 7) continue
    if (tree.k === 'bin' && tree.l.k === 'neg' && precOf(tree.l.a) < 7) continue
    if (countOps(tree) < (level === 1 ? 2 : 3)) continue
    try { ev(tree) } catch (e) { if (e instanceof Bad) continue; throw e }
    const expr = show(tree)
    return { id: 'gen-u1-' + hash(expr), expr, level }
  }
  return { id: 'gen-u1-fallback', expr: '1 + 2 ^ 3 * 4', level }
}
