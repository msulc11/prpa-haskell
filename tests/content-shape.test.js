// Rychlá kontrola tvaru dat v js/data/ (bez GHC).  node tests/content-shape.test.js
import { fixed, generate as gen1 } from '../js/data/uloha1.js'
import { bugs } from '../js/data/uloha2.js'
import { tasks as tasks3, generate as gen3 } from '../js/data/uloha3.js'
import { tasks as tasks4, generate as gen4 } from '../js/data/uloha4.js'
import { sections } from '../js/data/teorie.js'
import { prpaSource } from '../js/data/prpa.js'
import { parenthesize } from './tools/content-parens.mjs'
import { mulberry32 } from './tools/content-ghc-lib.mjs'

let failures = 0, checks = 0
const check = (cond, msg) => { checks++; if (!cond) { failures++; console.log('CHYBA ' + msg) } }
const isStr = (s) => typeof s === 'string' && s.length > 0
const uniqueIds = (xs, label) => {
  const seen = new Set()
  for (const x of xs) { check(!seen.has(x.id), `${label}: duplicitní id ${x.id}`); seen.add(x.id) }
}
const noDash = (s, where) => check(!/—/.test(s), `${where}: em-dash v textu`)
const balancedTicks = (s, where) => check((s.match(/`/g) || []).length % 2 === 0, `${where}: lichý počet backticků`)

// úloha 1
uniqueIds(fixed, 'uloha1')
for (const f of fixed) {
  check(isStr(f.id) && isStr(f.expr) && isStr(f.value) && isStr(f.parens), `uloha1 ${f.id}: chybí pole`)
  check([1, 2, 3].includes(f.level), `uloha1 ${f.id}: level`)
  check(parenthesize(f.expr) === f.parens, `uloha1 ${f.id}: parens nesedí s parserem`)
}
{
  const a = mulberry32(1), b = mulberry32(1)
  for (let i = 0; i < 1000; i++) {
    const x = gen1(a), y = gen1(b)
    check(x.expr === y.expr, 'uloha1 generate není deterministický')
    check(isStr(x.expr) && [1, 2, 3].includes(x.level) && isStr(x.id), 'uloha1 generate: tvar')
    try { parenthesize(x.expr) } catch (e) { check(false, `uloha1 generate: "${x.expr}" ${e.message}`) }
  }
}

// úloha 2
uniqueIds(bugs, 'uloha2')
for (const b of bugs) {
  const w = `uloha2 ${b.id}`
  check(isStr(b.code) && isStr(b.name) && isStr(b.question) && isStr(b.explanation) && isStr(b.ghcError), `${w}: chybí pole`)
  check(['type', 'syntax', 'scope'].includes(b.kind), `${w}: kind`)
  check(Array.isArray(b.options) && b.options.length === 4 && b.options.every(isStr), `${w}: options`)
  check(Number.isInteger(b.correct) && b.correct >= 0 && b.correct < b.options.length, `${w}: correct`)
  check(Array.isArray(b.spots) && b.spots.length > 0, `${w}: spots`)
  for (const s of b.spots) {
    let i = -1
    for (let k = 0; k <= s.nth; k++) i = b.code.indexOf(s.text, i + 1)
    check(i >= 0, `${w}: spot ${JSON.stringify(s)} v kódu není`)
  }
  check(Array.isArray(b.fixes) && b.fixes.length > 0 && b.fixes.every(isStr), `${w}: fixes`)
  check(Array.isArray(b.tests) && b.tests.every((t) => isStr(t.expr) && isStr(t.expected)), `${w}: tests`)
  check(b.code.toLowerCase().includes(b.name.toLowerCase()), `${w}: jméno funkce není v kódu`)
  ;[b.explanation, ...b.options].forEach((s) => { noDash(s, w); balancedTicks(s, w) })
}

// úlohy 3 a 4
const TOPICS = ['podmínky', 'stráže', 'vzory', 'rekurze', 'seznamy', 'generátor seznamu']
function checkTask(t, w, generated) {
  check(isStr(t.id) && isStr(t.name) && isStr(t.signature) && isStr(t.text), `${w}: chybí pole`)
  check(TOPICS.includes(t.topic), `${w}: topic ${t.topic}`)
  check(t.signature.startsWith(t.name + ' '), `${w}: signature nezačíná jménem`)
  check(Array.isArray(t.tests) && t.tests.length >= 3, `${w}: málo testů`)
  for (const x of t.tests) {
    check(isStr(x.expr) && x.expr.includes(t.name), `${w}: test ${x.expr}`)
    check(generated ? x.expected === null : isStr(x.expected), `${w}: expected u ${x.expr}`)
  }
  check(Array.isArray(t.solutions) && t.solutions.length >= 1, `${w}: řešení`)
  for (const s of t.solutions) {
    check(isStr(s.label) && isStr(s.code), `${w}: řešení bez label/code`)
    check(new RegExp('^' + t.name + '\\b', 'm').test(s.code), `${w}: řešení ${s.label} nedefinuje ${t.name}`)
  }
  check(Array.isArray(t.hints) && t.hints.length >= 1 && t.hints.every(isStr), `${w}: hints`)
  ;[t.text, ...t.hints].forEach((s) => { noDash(s, w); balancedTicks(s, w) })
}
for (const [tasks, gen, label] of [[tasks3, gen3, 'uloha3'], [tasks4, gen4, 'uloha4']]) {
  uniqueIds(tasks, label)
  tasks.forEach((t) => checkTask(t, `${label} ${t.id}`, false))
  const a = mulberry32(3), b = mulberry32(3)
  for (let i = 0; i < 500; i++) {
    const x = gen(a), y = gen(b)
    check(x.text === y.text, `${label} generate není deterministický`)
    checkTask(x, `${label} generate ${x.id}`, true)
  }
}

// tahák
uniqueIds(sections, 'teorie')
for (const s of sections) {
  check(isStr(s.id) && isStr(s.title) && Array.isArray(s.blocks) && s.blocks.length > 0, `teorie ${s.id}: tvar`)
  for (const b of s.blocks) {
    const w = `teorie ${s.id}`
    if (b.type === 'p') { check(isStr(b.text), `${w}: p bez textu`); noDash(b.text, w); balancedTicks(b.text, w) }
    else if (b.type === 'code') {
      check(isStr(b.code) && typeof b.run === 'boolean' && ['expr', 'defs', 'text'].includes(b.kind), `${w}: code blok`)
      if (b.kind === 'defs') check(Array.isArray(b.try), `${w}: defs bez try`)
    } else if (b.type === 'table') {
      check(Array.isArray(b.head) && b.rows.every((r) => r.length === b.head.length), `${w}: tabulka`)
      b.rows.flat().forEach((c) => { noDash(c, w); balancedTicks(c, w) })
    } else check(false, `${w}: neznámý blok ${b.type}`)
  }
}

check(isStr(prpaSource) && prpaSource.includes('faktorial'), 'prpa: prpaSource')

console.log(`${checks} kontrol, ${failures ? failures + ' CHYB' : 'vše v pořádku'}`)
console.log(`uloha1: ${fixed.length} pevných, uloha2: ${bugs.length}, uloha3: ${tasks3.length}, uloha4: ${tasks4.length}, teorie: ${sections.length} sekcí`)
process.exit(failures ? 1 : 0)
