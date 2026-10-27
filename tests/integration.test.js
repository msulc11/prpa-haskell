// Celý obsah (js/data) proti interpretu (js/hs): to, co uvidí student v aplikaci.
// node tests/integration.test.js
import { Session, exprTree, parenthesize, evalSteps, sameStructure, tokenize } from '../js/hs/index.js'
import * as u1 from '../js/data/uloha1.js'
import { bugs } from '../js/data/uloha2.js'
import * as u3 from '../js/data/uloha3.js'
import * as u4 from '../js/data/uloha4.js'
import { sections } from '../js/data/teorie.js'
import { prpaSource } from '../js/data/prpa.js'

let pass = 0
const fails = []
const check = (ok, what) => { if (ok) pass++; else fails.push(what) }

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const run = (code, expr) => {
  const s = new Session()
  const l = s.load(code)
  if (!l.ok) return { load: l }
  return { load: l, r: s.eval(expr) }
}

// ---------- úloha 1 ----------
for (const t of u1.fixed) {
  const r = new Session().eval(t.expr)
  check(r.ok && r.output === t.value, `u1 ${t.id}: value ${r.ok ? r.output : r.error.message} != ${t.value}`)
  check(parenthesize(t.expr) === t.parens, `u1 ${t.id}: parens '${parenthesize(t.expr)}' != '${t.parens}'`)
  check(sameStructure(t.expr, t.parens), `u1 ${t.id}: sameStructure(expr, parens)`)
  check(exprTree(t.expr).ok, `u1 ${t.id}: exprTree`)
  const st = evalSteps(t.expr)
  if (st.ok) check(st.value === t.value, `u1 ${t.id}: evalSteps value ${st.value} != ${t.value}`)
}
const seen1 = new Set()
for (let i = 0; i < 400; i++) {
  const g = u1.generate(rng(1000 + i))
  seen1.add(g.expr)
  const r = new Session().eval(g.expr)
  check(r.ok, `u1 gen ${g.expr}: ${r.ok ? '' : r.error.message}`)
  const tr = exprTree(g.expr)
  check(tr.ok, `u1 gen exprTree ${g.expr}`)
  if (tr.ok) {
    const p = parenthesize(g.expr)
    const rp = new Session().eval(p)
    check(rp.ok && r.ok && rp.output === r.output, `u1 gen parens value ${g.expr} -> ${p}`)
    check(sameStructure(g.expr, p), `u1 gen sameStructure ${g.expr}`)
  }
}

// ---------- úloha 2 ----------
for (const b of bugs) {
  const s = new Session()
  const l = s.load(b.code)
  let failed = !l.ok
  if (l.ok && b.use) failed = !s.eval(b.use).ok
  check(failed, `u2 ${b.id}: buggy code accepted by engine`)
  if (!l.ok) check(['parse', 'scope', 'type'].includes(l.error.kind), `u2 ${b.id}: error kind ${l.error.kind}`)
  for (const f of b.fixes) {
    const sf = new Session()
    const lf = sf.load(f)
    check(lf.ok, `u2 ${b.id}: fix rejected: ${f} :: ${lf.ok ? '' : lf.error.message}`)
    if (!lf.ok) continue
    for (const t of b.tests ?? []) {
      const r = sf.eval(t.expr)
      check(r.ok && r.output === t.expected, `u2 ${b.id}: ${t.expr} = ${r.ok ? r.output : r.error.message}, expected ${t.expected}`)
    }
    if (b.use && !(b.tests ?? []).length) check(sf.eval(b.use).ok, `u2 ${b.id}: use fails on fix ${f}`)
  }
  const toks = tokenize(b.code)
  check(toks.map(t => t.text).join('') === b.code, `u2 ${b.id}: tokenize lossless`)
}

// ---------- úlohy 3 a 4 ----------
for (const [label, mod] of [['u3', u3], ['u4', u4]]) {
  for (const t of mod.tasks) {
    for (const sol of t.solutions) {
      const s = new Session()
      const l = s.load(sol.code)
      check(l.ok, `${label} ${t.id} [${sol.label}]: load ${l.ok ? '' : l.error.message}`)
      if (!l.ok) continue
      check(l.names.includes(t.name), `${label} ${t.id}: name ${t.name} not defined`)
      for (const test of t.tests) {
        const r = s.eval(test.expr)
        check(r.ok && r.output === test.expected, `${label} ${t.id} [${sol.label}]: ${test.expr} = ${r.ok ? r.output : r.error.message}, expected ${test.expected}`)
      }
    }
  }
  for (let i = 0; i < 150; i++) {
    const g = mod.generate(rng(5000 + i))
    const ref = new Session()
    const lr = ref.load(g.solutions[0].code)
    check(lr.ok, `${label} gen ${g.id}: ref load ${lr.ok ? '' : lr.error.message}`)
    if (!lr.ok) continue
    const outs = g.tests.map(t => ref.eval(t.expr))
    outs.forEach((o, k) => check(o.ok, `${label} gen ${g.id}: ${g.tests[k].expr} -> ${o.ok ? '' : o.error.message}`))
    for (const sol of g.solutions.slice(1)) {
      const s = new Session()
      const l = s.load(sol.code)
      check(l.ok, `${label} gen ${g.id} [${sol.label}] load`)
      if (!l.ok) continue
      g.tests.forEach((t, k) => {
        const r = s.eval(t.expr)
        check(r.ok && outs[k].ok && r.output === outs[k].output, `${label} gen ${g.id} [${sol.label}]: ${t.expr} differs`)
      })
    }
  }
}

// ---------- tahák ----------
for (const sec of sections) {
  for (const b of sec.blocks) {
    if (b.type !== 'code' || !b.run) continue
    const s = new Session()
    if (b.kind === 'defs') {
      const l = s.load(b.code)
      check(l.ok, `teorie ${sec.id}: defs load ${l.ok ? '' : l.error.message}`)
      if (l.ok) for (const e of b.try ?? []) check(s.eval(e).ok, `teorie ${sec.id}: try ${e}`)
    } else if (b.kind === 'expr') {
      for (const line of b.code.split('\n')) {
        const m = line.match(/^(.*?)\s+--\s+(.*)$/)
        if (!m || line.trim().startsWith('--')) continue
        const r = s.eval(m[1].trim())
        const want = m[2].trim()
        check(r.ok && r.output === want, `teorie ${sec.id}: ${m[1].trim()} = ${r.ok ? r.output : r.error.message}, expected ${want}`)
      }
    }
  }
}

// ---------- prpa.hs ----------
{
  const s = new Session()
  const l = s.load(prpaSource)
  check(l.ok, `prpa.js load ${l.ok ? '' : l.error.message}`)
}

console.log(`${pass} kontrol prošlo, ${fails.length} selhalo (u1 gen různých: ${seen1.size})`)
for (const f of fails.slice(0, 60)) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
