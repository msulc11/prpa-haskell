import { add, h, clear, row, nav, rngFrom, newSeed } from './dom.js'
import { store } from './store.js'
import { TASKS, loadList } from './app.js'

export const EXAM_TEXT = {
  1: 'Určete výslednou hodnotu výrazu. Též doplňte do výrazu všechny závorky tak, aby explicitně určovaly pořadí všech jednotlivých kroků výpočtu shodně s pořadím kroků při výpočtu výrazu bez závorek.',
  2: 'Ve funkci je právě jedna chyba. Najděte a popište ji a pak se ji pokuste opravit.',
  3: 'Napište funkci podle zadání. Kód se ověří testy včetně hraničních případů (rovnost, nula, záporná čísla).',
  4: 'Napište funkci nad seznamem. Jde to rekurzí i generátorem seznamu, testy obsahují i prázdný seznam.',
}

const generators = {
  1: () => import('../data/uloha1.js').then(m => m.generate),
  3: () => import('../data/uloha3.js').then(m => m.generate),
  4: () => import('../data/uloha4.js').then(m => m.generate),
}

export async function generateTask(n) {
  const gen = await generators[n]()
  const task = gen(rngFrom(newSeed()))
  store.saveGenerated({ ...task, generated: true })
  return task
}

export async function findTask(n, id) {
  if (id.startsWith('gen')) {
    const t = store.generated(id)
    if (t) return t
  }
  const list = await loadList(n)
  return list.find(t => t.id === id)
}

// Kam po „Další“: další nevyřešená v seznamu, jinak nová vygenerovaná varianta.
export async function nextHref(n, currentId) {
  const list = await loadList(n)
  const i = list.findIndex(t => t.id === currentId)
  const after = [...list.slice(i + 1), ...list.slice(0, Math.max(0, i))]
  const next = after.find(t => !store.isSolved(t.id)) ?? (generators[n] ? null : after[0])
  if (next) return `#/u/${n}/${encodeURIComponent(next.id)}`
  const g = await generateTask(n)
  return `#/u/${n}/${encodeURIComponent(g.id)}`
}

export function position(list, id) {
  const i = list.findIndex(t => t.id === id)
  return i >= 0 ? `${i + 1} / ${list.length}` : 'nová'
}

function itemRow(n, t) {
  const href = `#/u/${n}/${encodeURIComponent(t.id)}`
  const done = store.isSolved(t.id)
  if (n === 1) return row({ href, title: h('span', { class: 'mono' }, t.expr), sub: t.source ?? null, done })
  if (n === 2) return row({ href, title: h('span', { class: 'mono' }, t.name), sub: t.source ?? shorten(t.code, 46), done })
  return row({ href, title: h('span', { class: 'mono' }, t.signature ?? t.name), sub: t.source ? `${t.source} · ${t.topic}` : t.topic, done })
}

function shorten(s, n) {
  const one = s.replace(/\s+/g, ' ')
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}

export async function taskList(view, n) {
  const list = await loadList(n)
  const done = list.filter(t => store.isSolved(t.id)).length
  const fromExam = list.filter(t => t.source)
  const rest = list.filter(t => !t.source)
  const first = list.find(t => !store.isSolved(t.id)) ?? list[0]

  const genBtn = generators[n]
    ? h('button', {
        class: 'btn sec grow', type: 'button',
        onclick: async () => { const g = await generateTask(n); location.hash = `#/u/${n}/${encodeURIComponent(g.id)}` },
      }, n === 1 ? 'Náhodný výraz' : 'Nová varianta')
    : null

  add(clear(view),
    nav(TASKS[n].title, { back: '#/', backLabel: 'Úlohy', right: `${done}/${list.length}` }),
    h('div', { class: 'card' }, h('h3', null, `Úloha ${n} (${TASKS[n].points} body)`), h('p', null, EXAM_TEXT[n])),
    h('div', { class: 'actions' },
      first ? h('a', { class: 'btn', href: `#/u/${n}/${encodeURIComponent(first.id)}` }, done ? 'Pokračovat' : 'Začít') : null,
      genBtn),
    fromExam.length ? [
      h('p', { class: 'group-title' }, 'Z loňských písemek'),
      h('div', { class: 'group' }, fromExam.map(t => itemRow(n, t))),
    ] : null,
    h('p', { class: 'group-title' }, fromExam.length ? 'Další procvičování' : 'Procvičování'),
    h('div', { class: 'group' }, rest.map(t => itemRow(n, t))))
}
