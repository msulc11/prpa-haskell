// Ověří veškerý obsah v js/data/ proti skutečnému GHC.
//   node tests/content-ghc.test.js            (vše, trvá několik minut)
//   node tests/content-ghc.test.js u1 u2      (jen vybrané části: u1 u2 u3 u4 prpa)
// Cestu ke GHC jde změnit proměnnou prostředí GHC_BIN.
import { existsSync } from 'node:fs'
import { GHC, run, pool, normMsg, typecheck, ghciEval, evalBatch, mulberry32 } from './tools/content-ghc-lib.mjs'
import { FIXITY, parenthesize } from './tools/content-parens.mjs'

const only = process.argv.slice(2)
const want = (s) => only.length === 0 || only.includes(s)
const GEN_SAMPLES = Number(process.env.GEN_SAMPLES || 300)

let failures = 0
const fail = (msg) => { failures++; console.log('  CHYBA ' + msg) }
const ok = (msg) => console.log('  ok    ' + msg)

if (!existsSync(GHC)) { console.log('GHC nenalezeno: ' + GHC + ' (nastav GHC_BIN)'); process.exit(2) }

function checkBatch(res, label) {
  if (!res.ok) { fail(`${label}: překlad selhal\n${res.compileOut.slice(0, 4000)}`); return false }
  return true
}

// ---------------------------------------------------------------- úloha 1
async function testU1() {
  console.log('\nÚloha 1')
  const { fixed, generate } = await import('../js/data/uloha1.js')

  // fixity našeho parseru = fixity GHC
  const ops = Object.keys(FIXITY)
  const args = ops.flatMap((o) => ['-e', `:i ${/^[a-z]/.test(o) ? o : '(' + o + ')'}`])
  const r = await run(GHC, ['-v0', ...args], { timeout: 120000 })
  const real = {}
  for (const m of r.out.matchAll(/^infix([lr]?) (\d) (\S+)/gm)) real[m[3].replace(/`/g, '')] = [+m[2], m[1] || 'n']
  for (const o of ops) {
    const g = real[o]
    if (!g || g[0] !== FIXITY[o][0] || g[1] !== FIXITY[o][1]) fail(`fixita ${o}: GHC ${JSON.stringify(g)} vs tabulka ${FIXITY[o]}`)
  }
  ok(`fixity ${ops.length} operátorů sedí s GHC`)

  for (const f of fixed) {
    try {
      const p = parenthesize(f.expr)
      if (p !== f.parens) fail(`${f.id}: parens "${f.parens}", parser dává "${p}"`)
    } catch (e) { fail(`${f.id}: parser ${e.message}`) }
  }
  const res = await evalBatch([{ key: 'fixed', code: '', exprs: fixed.flatMap((f) => [f.expr, f.parens]) }], 'u1')
  if (checkBatch(res, 'u1 fixed')) {
    const out = res.results.get('fixed')
    fixed.forEach((f, i) => {
      const a = out[2 * i], b = out[2 * i + 1]
      if (!a?.ok) fail(`${f.id}: ${a?.err}`)
      else if (a.value !== f.value) fail(`${f.id}: value "${f.value}", GHC "${a.value}"`)
      if (!b?.ok || b.value !== a?.value) fail(`${f.id}: uzávorkovaný tvar dává "${b?.value ?? b?.err}"`)
    })
    ok(`${fixed.length} pevných výrazů (hodnota + závorky)`)
  }

  const rng = mulberry32(12345)
  const samples = Array.from({ length: GEN_SAMPLES }, () => generate(rng))
  const seen = new Set(), exprs = []
  for (const s of samples) {
    if (!s.expr || ![1, 2, 3].includes(s.level)) fail('generate: špatný tvar ' + JSON.stringify(s))
    try { parenthesize(s.expr) } catch (e) { fail(`generate: parser neumí "${s.expr}": ${e.message}`) }
    if (!seen.has(s.expr)) { seen.add(s.expr); exprs.push(s.expr) }
  }
  const g = await evalBatch([{ key: 'gen', code: '', exprs }], 'u1gen')
  if (checkBatch(g, 'u1 generate')) {
    let bad = 0
    g.results.get('gen').forEach((x, i) => { if (!x?.ok) { bad++; fail(`generate "${exprs[i]}": ${x?.err}`) } })
    const lv = [1, 2, 3].map((l) => samples.filter((s) => s.level === l).length)
    ok(`generate: ${exprs.length} různých výrazů z ${samples.length}, úrovně ${lv.join('/')}, chyb ${bad}`)
  }
}

// ---------------------------------------------------------------- úloha 2
function spotIndex(code, { text, nth }) {
  let i = -1
  for (let k = 0; k <= nth; k++) { i = code.indexOf(text, i + 1); if (i < 0) return -1 }
  return i
}

async function testU2() {
  console.log('\nÚloha 2')
  const { bugs } = await import('../js/data/uloha2.js')
  for (const b of bugs) {
    for (const s of b.spots) if (spotIndex(b.code, s) < 0) fail(`${b.id}: spot ${JSON.stringify(s)} v kódu není`)
  }
  const checks = await pool(bugs, 6, async (b) => {
    const tc = await typecheck(b.code, 'u2')
    let out = tc.out
    if (b.use) {
      if (!tc.ok) return { b, err: `má use, ale definice neprojde: ${tc.out.slice(0, 300)}` }
      const ev = await ghciEval(b.code, b.use)
      if (ev.ok) return { b, err: `\`${b.use}\` v GHCi projde, chyba se neprojevila` }
      out = ev.out
    } else if (tc.ok) return { b, err: 'chybný kód GHC přeloží' }
    if (!normMsg(out).includes(normMsg(b.ghcError))) return { b, err: `ghcError nesedí.\n   čekáno: ${b.ghcError}\n   GHC: ${out.split('\n').slice(0, 6).join('\n        ')}` }
    const fx = await Promise.all(b.fixes.map((f) => typecheck(f, 'u2fix')))
    const badFix = fx.findIndex((x) => !x.ok)
    if (badFix >= 0) return { b, err: `oprava ${badFix} se nepřeloží: ${fx[badFix].out.slice(0, 400)}` }
    return { b }
  })
  for (const c of checks) if (c.err) fail(`${c.b.id}: ${c.err}`)
  ok(`${bugs.length} chyb: buggy kód neprojde, hláška sedí, opravy se přeloží`)

  const entries = bugs.flatMap((b) => b.tests.length ? b.fixes.map((f, i) => ({ key: `${b.id}#${i}`, code: f, exprs: b.tests.map((t) => t.expr), b })) : [])
  const res = await evalBatch(entries, 'u2tests')
  if (checkBatch(res, 'u2 testy')) {
    let n = 0
    for (const e of entries) {
      res.results.get(e.key).forEach((x, i) => {
        n++
        const t = e.b.tests[i]
        if (!x?.ok) fail(`${e.key} ${t.expr}: ${x?.err}`)
        else if (x.value !== t.expected) fail(`${e.key} ${t.expr}: čekáno ${t.expected}, GHC ${x.value}`)
      })
    }
    ok(`${n} testů oprav`)
  }
}

// ---------------------------------------------------------------- úlohy 3 a 4
async function testTasks(mod, label, tag) {
  console.log('\n' + label)
  const { tasks, generate } = await import(mod)
  const entries = tasks.flatMap((t) => t.solutions.map((s, i) => ({ key: `${t.id}#${i}`, code: s.code, exprs: t.tests.map((x) => x.expr), t })))
  const res = await evalBatch(entries, tag)
  if (checkBatch(res, label + ' řešení')) {
    let n = 0
    for (const e of entries) {
      res.results.get(e.key).forEach((x, i) => {
        n++
        const t = e.t.tests[i]
        if (!x?.ok) fail(`${e.key} ${t.expr}: ${x?.err}`)
        else if (x.value !== t.expected) fail(`${e.key} ${t.expr}: čekáno ${t.expected}, GHC ${x.value}`)
      })
    }
    ok(`${tasks.length} úloh, ${entries.length} řešení, ${n} testů`)
  }

  const rng = mulberry32(777)
  const samples = Array.from({ length: GEN_SAMPLES }, () => generate(rng))
  const uniq = new Map()
  for (const s of samples) {
    const k = s.name + '|' + s.solutions.map((x) => x.code).join('|') + '|' + s.tests.map((x) => x.expr).join('|')
    if (!uniq.has(k)) uniq.set(k, s)
    if (s.tests.some((x) => x.expected !== null)) fail(`generate ${s.id}: expected má být null`)
    if (!s.text || !s.name || !s.solutions.length || s.tests.length < 3) fail(`generate ${s.id}: neúplná úloha`)
  }
  const gen = [...uniq.values()]
  const ge = gen.flatMap((t, ti) => t.solutions.map((s, i) => ({ key: `g${ti}#${i}`, code: s.code, exprs: t.tests.map((x) => x.expr), t })))
  const gr = await evalBatch(ge, tag + 'gen')
  if (checkBatch(gr, label + ' generate')) {
    let bad = 0
    gen.forEach((t, ti) => {
      const outs = t.solutions.map((_, i) => gr.results.get(`g${ti}#${i}`))
      outs[0].forEach((x, k) => {
        if (!x?.ok) { bad++; fail(`generate ${t.name} ${t.tests[k].expr}: ${x?.err}`); return }
        for (let i = 1; i < outs.length; i++) {
          if (outs[i][k]?.value !== x.value) { bad++; fail(`generate ${t.name}: řešení ${i} dává ${outs[i][k]?.value ?? outs[i][k]?.err} místo ${x.value} pro ${t.tests[k].expr}\n${t.solutions[i].code}`) }
        }
      })
    })
    ok(`generate: ${gen.length} různých variant z ${samples.length}, všechna řešení se shodují (chyb ${bad})`)
  }
}

// ---------------------------------------------------------------- prpa.hs
async function testPrpa() {
  console.log('\nprpa.js')
  const { prpaSource } = await import('../js/data/prpa.js')
  const tc = await typecheck(prpaSource, 'prpa')
  if (!tc.ok) fail('prpaSource se nepřeloží:\n' + tc.out.slice(0, 3000))
  else ok('prpaSource se přeloží')
  const exprs = ['faktorial 5', "faktorial' 5", "faktorial'' 5", 'nsd 12 18', 'posledniPrvek [1,2,3]', 'smazVsechny 2 [1,2,3,2]', 'otoc [1,2,3]', 'prvek 3 [1,2,3]', 'zvys [1,2,3]', 'aplikujBinarniFunkci 1 2 (+)']
  const res = await evalBatch([{ key: 'prpa', code: prpaSource, exprs }], 'prpaev')
  if (checkBatch(res, 'prpa')) {
    const vals = res.results.get('prpa').map((x, i) => `${exprs[i]} = ${x?.ok ? x.value : 'CHYBA ' + x?.err}`)
    if (res.results.get('prpa').some((x) => !x?.ok)) fail(vals.join('; '))
    else ok(vals.join('; '))
  }
}

// ---------------------------------------------------------------- tahák
async function testTeorie() {
  console.log('\nTahák (teorie.js)')
  const { sections } = await import('../js/data/teorie.js')
  const entries = []
  sections.forEach((s) => s.blocks.forEach((b, bi) => {
    if (b.type !== 'code') return
    if (b.kind === 'expr') {
      const lines = b.code.split('\n').filter((l) => l.trim())
      const parsed = lines.map((l) => l.match(/^(.*?)\s+--\s(.*)$/) || [null, l, null])
      entries.push({ key: `${s.id}#${bi}`, code: '', exprs: parsed.map((m) => m[1]), expected: parsed.map((m) => m[2]?.trim() ?? null) })
    } else if (b.kind === 'defs') {
      entries.push({ key: `${s.id}#${bi}`, code: b.code, exprs: b.try, expected: b.try.map(() => null) })
    }
  }))
  const res = await evalBatch(entries, 'teorie')
  if (!checkBatch(res, 'teorie')) return
  let n = 0
  for (const e of entries) {
    res.results.get(e.key).forEach((x, i) => {
      n++
      if (!x?.ok) fail(`${e.key} ${e.exprs[i]}: ${x?.err}`)
      else if (e.expected[i] !== null && x.value !== e.expected[i]) fail(`${e.key} ${e.exprs[i]}: v taháku "${e.expected[i]}", GHC "${x.value}"`)
      else if (process.env.VERBOSE) console.log(`        ${e.exprs[i]}  =>  ${x.value}`)
    })
  }
  ok(`${sections.length} sekcí, ${entries.length} bloků kódu, ${n} výrazů`)
}

const t0 = Date.now()
if (want('teorie')) await testTeorie()
if (want('u1')) await testU1()
if (want('u2')) await testU2()
if (want('u3')) await testTasks('../js/data/uloha3.js', 'Úloha 3', 'u3')
if (want('u4')) await testTasks('../js/data/uloha4.js', 'Úloha 4', 'u4')
if (want('prpa')) await testPrpa()
console.log(`\n${failures ? failures + ' CHYB' : 'Vše v pořádku'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
process.exit(failures ? 1 : 0)
