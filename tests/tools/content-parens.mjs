// Malý parser výrazů s haskellovskými fixitami (algoritmus z Haskell Reportu, kap. 10.6).
// Slouží jen k ověření pole `parens` v js/data/uloha1.js. Fixity se v testu porovnají s `:i` z GHCi.

export const FIXITY = {
  '.': [9, 'r'], '!!': [9, 'l'],
  '^': [8, 'r'], '^^': [8, 'r'], '**': [8, 'r'],
  '*': [7, 'l'], '/': [7, 'l'], div: [7, 'l'], mod: [7, 'l'], rem: [7, 'l'], quot: [7, 'l'],
  '+': [6, 'l'], '-': [6, 'l'],
  ':': [5, 'r'], '++': [5, 'r'],
  '==': [4, 'n'], '/=': [4, 'n'], '<': [4, 'n'], '<=': [4, 'n'], '>': [4, 'n'], '>=': [4, 'n'], elem: [4, 'n'], notElem: [4, 'n'],
  '&&': [3, 'r'], '||': [2, 'r'], '$': [0, 'r'],
}
const fix = (op) => FIXITY[op] || [9, 'l']

function lex(src) {
  const toks = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    let m
    const rest = src.slice(i)
    if ((m = rest.match(/^\d+(\.\d+)?/))) toks.push({ t: 'num', v: m[0] })
    else if ((m = rest.match(/^[a-z_][A-Za-z0-9_']*/))) toks.push({ t: 'id', v: m[0] })
    else if ((m = rest.match(/^[A-Z][A-Za-z0-9_']*/))) toks.push({ t: 'con', v: m[0] })
    else if ((m = rest.match(/^`([A-Za-z_][A-Za-z0-9_']*)`/))) toks.push({ t: 'op', v: m[1], bt: true })
    else if ((m = rest.match(/^[!#$%&*+./<=>?@\\^|~:-]+/))) toks.push({ t: 'op', v: m[0] })
    else if ((m = rest.match(/^"([^"\\]|\\.)*"/))) toks.push({ t: 'str', v: m[0] })
    else if ((m = rest.match(/^'([^'\\]|\\.)'/))) toks.push({ t: 'chr', v: m[0] })
    else if ('()[],'.includes(c)) toks.push({ t: c, v: c })
    else throw new Error('lex: ' + rest)
    i += (m ? m[0].length : 1)
  }
  return toks
}

export function parse(src) {
  const toks = lex(src)
  let p = 0
  const peek = () => toks[p]
  const next = () => toks[p++]
  const expect = (t) => { const k = next(); if (!k || k.t !== t) throw new Error(`expected ${t}`); return k }
  const isAtomStart = (k) => k && (k.t === 'num' || k.t === 'id' || k.t === 'con' || k.t === 'str' || k.t === 'chr' || k.t === '(' || k.t === '[')

  function aexp() {
    const k = next()
    if (k.t === 'num' || k.t === 'str' || k.t === 'chr') return { k: 'lit', v: k.v }
    if (k.t === 'id' || k.t === 'con') return { k: 'var', v: k.v }
    if (k.t === '[') {
      const items = []
      if (peek().t !== ']') { items.push(expr()); while (peek().t === ',') { next(); items.push(expr()) } }
      expect(']')
      return { k: 'list', items }
    }
    if (k.t === '(') {
      const a = peek()
      if (a.t === 'op' && toks[p + 1]?.t === ')') { next(); next(); return { k: 'opfn', op: a.v, bt: a.bt } }
      if (a.t === 'op' && a.v !== '-') { next(); const e = expr(); expect(')'); return { k: 'sec', side: 'right', op: a.v, bt: a.bt, arg: e } }
      // levý řez: (e op)
      const save = p
      try {
        const items = infixItems(true)
        if (peek().t === ')' && items.length >= 2 && items[items.length - 1].op) {
          next()
          const opTok = items.pop()
          return { k: 'sec', side: 'left', op: opTok.op, bt: opTok.bt, arg: resolve(items) }
        }
      } catch (_) { /* není řez */ }
      p = save
      const e = expr(); expect(')'); e.paren = true; return e
    }
    throw new Error('unexpected ' + k.v)
  }
  function fexp() {
    const f = aexp()
    const args = []
    while (isAtomStart(peek())) args.push(aexp())
    return args.length ? { k: 'app', fn: f, args } : f
  }
  // posloupnost operandů a operátorů; '-' na začátku / po operátoru = negace
  function infixItems(allowTrailingOp = false) {
    const items = []
    let wantOperand = true
    while (true) {
      const k = peek()
      if (wantOperand) {
        if (k && k.t === 'op' && k.v === '-') { next(); items.push({ neg: true }); continue }
        items.push({ e: fexp() }); wantOperand = false
      } else {
        if (k && k.t === 'op') {
          next(); items.push({ op: k.v, bt: k.bt })
          if (allowTrailingOp && peek()?.t === ')') return items
          wantOperand = true
        } else return items
      }
    }
  }
  function resolve(items) {
    let q = 0
    function parseNeg(prec1, fix1) {
      const it = items[q]
      if (it.neg) {
        if (prec1 >= 6) throw new Error('bad negation')
        q++
        const r = parseNeg(6, 'l')
        return parse1(prec1, fix1, { k: 'neg', arg: r })
      }
      q++
      return parse1(prec1, fix1, it.e)
    }
    function parse1(prec1, fix1, e1) {
      while (q < items.length) {
        const o = items[q]
        const [prec2, fix2] = fix(o.op)
        if (prec1 === prec2 && (fix1 !== fix2 || fix1 === 'n')) throw new Error('precedence parsing error')
        if (prec1 > prec2 || (prec1 === prec2 && fix1 === 'l')) return e1
        q++
        const r = parseNeg(prec2, fix2)
        e1 = { k: 'op', op: o.op, bt: o.bt, l: e1, r }
      }
      return e1
    }
    return parseNeg(-1, 'n')
  }
  function expr() { return resolve(infixItems()) }
  const e = expr()
  if (p !== toks.length) throw new Error('trailing input')
  return e
}

const opText = (op, bt) => (bt ? '`' + op + '`' : op)
const isAtom = (n) => n.k === 'lit' || n.k === 'var' || n.k === 'list' || n.k === 'opfn' || n.k === 'sec'

// plně uzávorkovaný zápis (vnější úroveň bez závorek)
export function full(n) {
  const wrap = (x) => (isAtom(x) ? full(x) : '(' + full(x) + ')')
  switch (n.k) {
    case 'lit': case 'var': return n.v
    case 'list': return '[' + n.items.map(full).join(', ') + ']'
    case 'opfn': return '(' + opText(n.op, n.bt) + ')'
    case 'sec': return n.side === 'left' ? `(${wrap(n.arg)} ${opText(n.op, n.bt)})` : `(${opText(n.op, n.bt)} ${wrap(n.arg)})`
    case 'neg': return '-' + wrap(n.arg)
    case 'op': return `${wrap(n.l)} ${opText(n.op, n.bt)} ${wrap(n.r)}`
    case 'app': {
      const f = n.fn.k === 'app' || (n.fn.paren && !isAtom(n.fn)) ? '(' + full(n.fn) + ')' : full(n.fn)
      return [f, ...n.args.map(wrap)].join(' ')
    }
  }
  throw new Error('full: ' + n.k)
}

export const parenthesize = (src) => full(parse(src))
