// Úlohy 3 a 4: napiš funkci, spusť testy. Nápověda a řešení jen na vyžádání.
import { add, h, clear, nav, inlineCode } from './dom.js'
import { store } from './store.js'
import { loadList, TASKS } from './app.js'
import { findTask, nextHref, position } from './lists.js'
import { codeView, errorCard, runTests, resolvedTests, resultsGroup } from './hsx.js'
import { createEditor } from './editor.js'

export async function u34View(view, n, rawId) {
  const id = decodeURIComponent(rawId)
  const task = await findTask(n, id)
  if (!task) { location.replace(`#/u/${n}`); return }
  const list = await loadList(n)
  const tests = resolvedTests(task)

  const out = h('div')
  const extra = h('div')
  let hintsShown = 0

  const ed = createEditor({
    value: store.code(task.id) ?? '',
    placeholder: `${task.signature ?? task.name} = …`,
    minLines: 5,
    onChange: v => store.setCode(task.id, v.trim() ? v : ''),
  })

  function run() {
    clear(out)
    document.activeElement?.blur()
    requestAnimationFrame(() => out.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    if (!ed.value.trim()) {
      add(out, h('div', { class: 'err-card' }, h('b', null, 'Editor je prázdný'), h('p', null, `Napiš definici funkce ${task.name}.`)))
      return
    }
    const r = runTests(ed.value, tests, { name: task.name })
    if (r.loadError) {
      ed.setErrorLine(r.loadError.where === 'expr' ? 0 : r.loadError.line)
      add(out, errorCard(r.loadError))
      return
    }
    ed.setErrorLine(0)
    const allOk = r.passed === r.total
    if (allOk) store.markSolved(task.id)
    add(out,
      h('p', { class: 'group-title' }, `Testy · ${r.passed} z ${r.total}`),
      resultsGroup(r.results),
      allOk ? [
        h('div', { class: 'ok-card' }, h('b', null, 'Všechny testy prošly'),
          task.solutions?.length > 1 ? h('p', null, 'Podívej se i na jiné způsoby řešení, na písemce se hodí znát víc zápisů.') : null),
        h('div', { class: 'actions' },
          task.solutions?.length ? h('button', { class: 'btn sec', type: 'button', onclick: showSolutions }, 'Jiná řešení') : null,
          h('button', { class: 'btn', type: 'button', onclick: async () => { location.hash = await nextHref(n, task.id) } }, 'Další úloha')),
      ] : null)
  }

  function showHint() {
    const hints = task.hints ?? []
    if (hintsShown >= hints.length) return
    add(extra, h('div', { class: 'hint-card' },
      h('b', null, `Nápověda ${hintsShown + 1} z ${hints.length}`),
      h('span', { html: inlineCode(hints[hintsShown]) })))
    hintsShown++
    if (hintsShown >= hints.length) hintBtn.disabled = true
  }

  let solutionsShown = false
  function showSolutions() {
    if (solutionsShown) return
    solutionsShown = true
    add(extra,
      h('p', { class: 'group-title' }, 'Řešení'),
      (task.solutions ?? []).map(s => [
        h('p', { class: 'group-title', style: { marginTop: '12px' } }, s.label),
        codeView(s.code),
      ]))
  }

  let confirmSolution = false
  const solBtn = h('button', { class: 'linkbtn', type: 'button' }, 'Ukázat řešení')
  solBtn.addEventListener('click', () => {
    if (!confirmSolution) { confirmSolution = true; solBtn.textContent = 'Opravdu? Ťukni znovu'; return }
    showSolutions()
    solBtn.hidden = true
  })

  const hintBtn = h('button', { class: 'btn sec', type: 'button', onclick: showHint, disabled: !(task.hints?.length) }, 'Nápověda')

  add(clear(view),
    nav(task.name, { back: `#/u/${n}`, backLabel: `Úloha ${n}`, right: position(list, task.id) }),
    h('div', { class: 'card' },
      h('h3', null, `Úloha ${n} (${TASKS[n].points} body)`),
      h('p', { html: inlineCode(task.text) }),
      task.source ? h('p', { class: 'sub' }, task.source) : task.generated ? h('p', { class: 'sub' }, 'Vygenerovaná varianta') : null),
    ed.el,
    h('div', { class: 'actions' }, hintBtn, h('button', { class: 'btn', type: 'button', onclick: run }, 'Spustit testy')),
    out,
    extra,
    h('div', { style: { margin: '14px 20px 0', textAlign: 'right' } }, solBtn))
}
