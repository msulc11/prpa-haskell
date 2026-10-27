import { add, h, clear, row } from './dom.js'
import { store } from './store.js'
import { installKeybar } from './editor.js'

const view = document.getElementById('view')
const tabs = document.getElementById('tabs')

export const TASKS = {
  1: { title: 'Výrazy a závorky', sub: 'Priorita a asociativita', color: '#5b47b8', points: 2 },
  2: { title: 'Najdi chybu', sub: 'Syntaktické a typové chyby', color: '#d6453b', points: 2 },
  3: { title: 'Podmínky', sub: 'if, stráže, vzory', color: '#2f7fd8', points: 3 },
  4: { title: 'Seznamy', sub: 'Rekurze, generátor seznamu', color: '#2a9a57', points: 3 },
}

// Data a pohledy se načítají líně, aby úvodní obrazovka naskočila hned.
const data = {
  1: () => import('../data/uloha1.js').then(m => m.fixed),
  2: () => import('../data/uloha2.js').then(m => m.bugs),
  3: () => import('../data/uloha3.js').then(m => m.tasks),
  4: () => import('../data/uloha4.js').then(m => m.tasks),
}
export const loadList = n => data[n]()

const routes = [
  [/^$/, () => home()],
  [/^u\/([1-4])$/, m => import('./lists.js').then(v => v.taskList(view, +m[1]))],
  [/^u\/1\/(.+)$/, m => import('./u1.js').then(v => v.u1View(view, m[1]))],
  [/^u\/2\/(.+)$/, m => import('./u2.js').then(v => v.u2View(view, m[1]))],
  [/^u\/([34])\/(.+)$/, m => import('./u34.js').then(v => v.u34View(view, +m[1], m[2]))],
  [/^pisemka$/, () => import('./exam.js').then(v => v.examView(view))],
  [/^tahak$/, () => import('./tahak.js').then(v => v.tahakList(view))],
  [/^tahak\/(.+)$/, m => import('./tahak.js').then(v => v.tahakSection(view, m[1]))],
  [/^konzole$/, () => import('./konzole.js').then(v => v.konzoleView(view))],
]

let cleanup = null
let navId = 0

async function route() {
  const id = ++navId
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  cleanup?.()
  cleanup = null
  document.body.classList.remove('kb')
  const tab = path.startsWith('pisemka') ? 'pisemka' : path.startsWith('tahak') ? 'tahak' : path.startsWith('konzole') ? 'konzole' : 'ulohy'
  for (const a of tabs.querySelectorAll('a')) a.classList.toggle('on', a.dataset.tab === tab)

  for (const [re, fn] of routes) {
    const m = path.match(re)
    if (!m) continue
    try {
      const res = await fn(m)
      if (id !== navId) return
      if (typeof res === 'function') cleanup = res
    } catch (e) {
      console.error(e)
      if (id !== navId) return
      add(clear(view),
        h('header', { class: 'nav' }, h('a', { class: 'back', href: '#/' }, 'Úlohy'), h('b', null, 'Chyba'), h('span')),
        h('div', { class: 'err-card' }, h('b', null, 'Stránku se nepodařilo načíst'), h('pre', null, String(e?.message ?? e))))
    }
    window.scrollTo(0, 0)
    return
  }
  location.replace('#/')
}

async function home() {
  const last = store.get('examHistory', []).at(-1)
  const counts = await Promise.all([1, 2, 3, 4].map(async n => {
    try {
      const list = await loadList(n)
      return { done: list.filter(t => store.isSolved(t.id)).length, total: list.length }
    } catch { return { done: 0, total: 0 } }
  }))

  add(clear(view),
    h('div', { class: 'large' }, h('h1', null, 'Haskell'), h('p', null, 'První písemka z PRPA, 4 úlohy za 10 bodů')),
    h('a', { class: 'hero', href: '#/pisemka' },
      h('strong', null, 'Cvičná písemka'),
      h('span', null, last
        ? `Nová varianta všech čtyř úloh. Minule ${last.score} z 10.`
        : 'Nová varianta všech čtyř úloh, opravená stejně jako na papíře.'),
      h('span', { class: 'b' }, 'Začít písemku')),
    h('p', { class: 'group-title' }, 'Úlohy'),
    h('div', { class: 'group' }, [1, 2, 3, 4].map((n, i) => row({
      href: `#/u/${n}`, icon: String(n), iconColor: TASKS[n].color,
      title: TASKS[n].title, sub: TASKS[n].sub,
      det: counts[i].total ? `${counts[i].done}/${counts[i].total}` : '',
    }))),
    h('p', { class: 'group-title' }, 'Ze cvičení'),
    h('div', { class: 'group' },
      row({ href: '#/tahak', title: 'Tahák', sub: 'Priority operátorů, vzory, stráže, seznamy' }),
      row({ href: '#/konzole', title: 'Konzole GHCi', sub: 'Funkce ze zápisků prpa.hs' })),
    h('p', { class: 'note' }, 'Kód se spouští přímo v telefonu ve zjednodušeném interpretu Haskellu. Výsledky i typové chyby odpovídají GHCi, drobné odchylky jsou možné.'))
}

installKeybar()
window.addEventListener('hashchange', route)
route()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {})
}
