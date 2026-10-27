// Editor kódu: textarea přes zvýrazněný <pre>, čísla řádků, automatické odsazení
// a lišta se symboly, které se na mobilní klávesnici špatně hledají.
import { add, h } from './dom.js'
import { highlightLines } from './hsx.js'

const LINE = 24

export function createEditor({ value = '', placeholder = '', onChange, minLines = 4, readOnly = false } = {}) {
  const gutter = h('div', { class: 'ed-gutter', 'aria-hidden': 'true' })
  const hl = h('pre', { class: 'ed-hl', 'aria-hidden': 'true' })
  const input = h('textarea', {
    class: 'ed-input code-input', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
    autocorrect: 'off', wrap: 'off', placeholder, rows: 1, 'aria-label': 'Kód v Haskellu', readonly: readOnly,
  })
  const area = h('div', { class: 'ed-area' }, hl, input)
  const el = h('div', { class: `ed${readOnly ? ' readonly' : ''}` }, gutter, h('div', { class: 'ed-scroll' }, area))
  let errLine = 0

  function render() {
    const v = input.value
    const lines = v.split('\n')
    const n = Math.max(lines.length, minLines)
    hl.innerHTML = highlightLines(v, errLine)
    gutter.innerHTML = Array.from({ length: n }, (_, i) =>
      `<div${i + 1 === errLine ? ' class="err"' : ''}>${i + 1}</div>`).join('')
    input.style.height = `${n * LINE + 24}px`
    const longest = Math.max(...lines.map(l => l.length), placeholder.length * (v ? 0 : 1))
    const w = `max(100%, calc(${longest + 3}ch + 18px))`
    input.style.width = w
    area.style.minWidth = w
  }

  input.value = value
  input.addEventListener('input', () => {
    if (errLine) errLine = 0
    render()
    onChange?.(input.value)
  })

  input.addEventListener('keydown', e => {
    if (e.isComposing) return
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      insertText(input, '    ')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pos = input.selectionStart
      const lineStart = input.value.lastIndexOf('\n', pos - 1) + 1
      const line = input.value.slice(lineStart, pos)
      let indent = line.match(/^\s*/)[0]
      // Hlavička funkce bez „=“ (např. „f (x:xs)“) – další řádek budou stráže.
      if (!indent && line.trim() && !line.includes('=') && !line.trim().startsWith('--')) indent = '    '
      if (/\b(where|let|of)\s*$/.test(line)) indent += '    '
      insertText(input, '\n' + indent)
    }
  })

  render()

  return {
    el,
    input,
    get value() { return input.value },
    set value(v) { input.value = v; errLine = 0; render() },
    focus() { input.focus() },
    setErrorLine(n) { errLine = n || 0; render() },
  }
}

export function insertText(el, text) {
  if (document.activeElement !== el) el.focus()
  let ok = false
  try { ok = document.execCommand('insertText', false, text) } catch { ok = false }
  if (!ok) {
    const s = el.selectionStart, e = el.selectionEnd
    el.setRangeText(text, s, e, 'end')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

// ---------- lišta se symboly ----------

const KEYS = ['⇥', '|', '=', ':', '_', '(', ')', '[', ']', '->', '<-', '==', '/=', '<', '>', "'", '`', ',', '..', '++', '\\', '$', '◀', '▶']

export function installKeybar() {
  const bar = h('div', { class: 'keybar', id: 'keybar', hidden: true, role: 'toolbar', 'aria-label': 'Symboly' })
  let target = null

  for (const k of KEYS) {
    const b = h('button', { type: 'button', 'aria-label': k === '⇥' ? 'Odsadit' : k === '◀' ? 'Kurzor vlevo' : k === '▶' ? 'Kurzor vpravo' : k }, k)
    b.addEventListener('pointerdown', e => e.preventDefault())
    b.addEventListener('click', () => {
      if (!target) return
      if (k === '◀' || k === '▶') {
        const p = Math.max(0, Math.min(target.value.length, target.selectionStart + (k === '◀' ? -1 : 1)))
        target.setSelectionRange(p, p)
      } else {
        insertText(target, k === '⇥' ? '    ' : k)
      }
    })
    add(bar, b)
  }
  const done = h('button', { type: 'button', class: 'wide' }, 'Hotovo')
  done.addEventListener('pointerdown', e => e.preventDefault())
  done.addEventListener('click', () => target?.blur())
  add(bar, done)
  add(document.body, bar)

  const place = () => {
    const vv = window.visualViewport
    if (!vv) return
    const layout = document.documentElement.clientHeight
    const offset = Math.max(0, layout - (vv.height + vv.offsetTop))
    bar.style.transform = `translateY(${-offset}px)`
  }
  window.visualViewport?.addEventListener('resize', place)
  window.visualViewport?.addEventListener('scroll', place)

  document.addEventListener('focusin', e => {
    const t = e.target
    if (t.matches?.('textarea, input')) document.body.classList.add('kb')
    if (t.matches?.('.code-input') && !t.readOnly) {
      target = t
      bar.hidden = false
      place()
    }
  })
  document.addEventListener('focusout', e => {
    setTimeout(() => {
      const a = document.activeElement
      if (!a?.matches?.('textarea, input')) document.body.classList.remove('kb')
      if (!a?.matches?.('.code-input')) { bar.hidden = true; target = null }
    }, 60)
  })
}
