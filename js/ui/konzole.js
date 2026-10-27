// Konzole: soubor (jako prpa.hs) + GHCi řádek. Sezení přežije přepínání obrazovek.
import { add, h, clear, nav } from './dom.js'
import { store } from './store.js'
import { createEditor } from './editor.js'
import { newSession, errorCard, kindLabel } from './hsx.js'

let session = null
let log = []
let tab = 'ghci'
let history = []
let pending = null

async function defaultSource() {
  try { return (await import('../data/prpa.js')).prpaSource } catch { return '-- sem piš funkce\n' }
}

function isReplLine(line) {
  return /^\s*(ghci)?>\s?/.test(line)
}

// Tahák posílá kód sem: definice se přidají do souboru, řádky „> výraz“ se spustí.
export function sendToConsole(code) {
  pending = code
  location.hash = '#/konzole'
}

function loadSource(src) {
  session = newSession()
  const r = session.load(src)
  return r
}

export async function konzoleView(view) {
  let source = store.get('consoleSource', null) ?? await defaultSource()
  let loadRes = session ? null : loadSource(source)
  if (!session) session = newSession()

  if (pending) {
    const lines = pending.split('\n')
    const defs = lines.filter(l => !isReplLine(l)).join('\n').trim()
    const cmds = lines.filter(isReplLine).map(l => l.replace(/^\s*(ghci)?>\s?/, ''))
    pending = null
    if (defs && /^[a-z_][\w']*.*=|^[a-z_][\w']*\s*::/m.test(defs)) {
      // Příklad z taháku se načte místo prpa.hs (jako :l jiného souboru), :r vrátí zápisky.
      session = newSession()
      const r = session.load(defs)
      log.push({ sys: r.ok ? `Načten příklad z taháku (${r.names.join(', ')}). Příkaz :r vrátí prpa.hs.` : 'Příklad se nepodařilo načíst', err: r.ok ? null : r.error })
    } else if (defs) {
      cmds.unshift(...defs.split('\n').filter(l => l.trim() && !l.trim().startsWith('--')))
    }
    for (const c of cmds) runLine(c)
    tab = 'ghci'
  } else if (loadRes) {
    log.push({ sys: loadRes.ok ? `Ok, načten prpa.hs (${loadRes.names.length} funkcí)` : 'prpa.hs se nepodařilo načíst', err: loadRes.ok ? null : loadRes.error })
  }

  const body = h('div')
  const seg = h('div', { class: 'seg', role: 'tablist' })
  const tabs = [['ghci', 'GHCi'], ['file', 'Soubor prpa.hs']]
  for (const [key, label] of tabs) {
    const b = h('button', { type: 'button', role: 'tab', class: tab === key ? 'on' : '' }, label)
    b.addEventListener('click', () => { tab = key; for (const x of seg.children) x.classList.toggle('on', x === b); render() })
    add(seg, b)
  }

  function runLine(line) {
    const text = line.trim()
    if (!text) return
    history = [text, ...history.filter(x => x !== text)].slice(0, 30)
    if (/^:(l|load|r|reload)\b/.test(text)) {
      const r = loadSource(source)
      log.push({ in: text, sys: r.ok ? `Ok, načteno ${r.names.length} funkcí` : 'Soubor se nepodařilo načíst', err: r.ok ? null : r.error })
      return
    }
    let r
    try { r = session.command(text) } catch (e) { r = { ok: false, error: { kind: 'runtime', message: String(e?.message ?? e) } } }
    log.push(r.ok ? { in: text, out: r.output } : { in: text, err: r.error })
  }

  function renderLog(box) {
    clear(box)
    for (const e of log.slice(-120)) {
      if (e.in != null) add(box, h('div', { class: 'in' }, h('b', null, 'ghci> '), e.in))
      if (e.sys) add(box, h('div', { class: 'in' }, e.sys))
      if (e.out != null && e.out !== '') add(box, h('div', { class: 'out' }, e.out))
      if (e.err) add(box, h('div', { class: 'er' },
        e.err.kind === 'runtime' ? (e.err.message.startsWith('***') ? e.err.message : `*** Exception: ${e.err.message}`) : `${kindLabel(e.err)}${e.err.line && e.in == null ? ` (řádek ${e.err.line})` : ''}: ${e.err.message}`,
        e.err.hint ? h('small', null, e.err.hint) : null))
    }
    box.scrollTop = box.scrollHeight
  }

  function examples() {
    return [
      'faktorial 5', ':t nsd', 'nsd 48 18', 'delka [1,2,3]', '[x^2 | x <- [1..10]]', 'smazVsechny 3 [1,3,2,3]',
      'zvysO2 5', '2^3^2', ':t (+2)', 'take 5 [1,3..]',
    ]
  }

  function render() {
    clear(body)
    if (tab === 'ghci') {
      const box = h('div', { class: 'repl', 'aria-live': 'polite' })
      const input = h('input', {
        class: 'input code-input', type: 'text', placeholder: 'výraz nebo :t výraz', enterkeyhint: 'go',
        autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Příkaz GHCi',
      })
      let hpos = -1
      const submit = () => { runLine(input.value); input.value = ''; hpos = -1; renderLog(box) }
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); submit() }
        else if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hpos = Math.min(hpos + 1, history.length - 1); input.value = history[hpos] }
        else if (e.key === 'ArrowDown') { e.preventDefault(); hpos = Math.max(hpos - 1, -1); input.value = hpos < 0 ? '' : history[hpos] }
      })
      const chips = h('div', { class: 'chips' }, [...new Set([...history.slice(0, 5), ...examples()])].map(c =>
        h('button', { type: 'button', onclick: () => { input.value = c; input.focus() } }, c)))
      add(body,
        box,
        h('div', { class: 'repl-input' }, h('span', null, 'λ'), input, h('button', { type: 'button', onclick: submit }, 'Spustit')),
        chips,
        h('p', { class: 'note' }, 'Funkce ze souboru prpa.hs jsou načtené. :t výraz ukáže typ, :r znovu načte soubor.'))
      renderLog(box)
    } else {
      const msg = h('div')
      const ed = createEditor({ value: source, minLines: 12, onChange: v => { source = v; store.set('consoleSource', v) } })
      add(body,
        ed.el,
        h('div', { class: 'actions' },
          h('button', { class: 'btn sec', type: 'button', onclick: async () => {
            source = await defaultSource()
            store.set('consoleSource', null)
            ed.value = source
            clear(msg)
          } }, 'Obnovit zápisky'),
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const r = loadSource(source)
            log.push({ in: ':r', sys: r.ok ? `Ok, načteno ${r.names.length} funkcí` : 'Soubor se nepodařilo načíst', err: r.ok ? null : r.error })
            clear(msg)
            if (r.ok) add(msg, h('div', { class: 'ok-card' }, h('b', null, `Načteno ${r.names.length} funkcí`), h('p', null, 'Zkus je v záložce GHCi.')))
            else { ed.setErrorLine(r.error.line); add(msg, errorCard(r.error)) }
          } }, 'Načíst (:l)')),
        msg)
    }
  }

  add(clear(view), nav('Konzole', { back: null }), seg, body)
  render()
}
