// Postup a rozepsaný kód v localStorage. Všechno v try/catch: v anonymním okně
// nebo se zakázaným úložištěm aplikace funguje dál, jen si nic nepamatuje.

const KEY = 'prpa-haskell-v1'
let state = read()
let timer = null

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

function write() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* bez úložiště */ }
  }, 250)
}

export const store = {
  isSolved(id) { return !!state.solved?.[id] },
  markSolved(id) {
    state.solved ??= {}
    if (!state.solved[id]) { state.solved[id] = Date.now(); write() }
  },
  code(id) { return state.code?.[id] },
  setCode(id, code) {
    state.code ??= {}
    if (code) state.code[id] = code
    else delete state.code[id]
    write()
  },
  get(key, fallback) { return state[key] ?? fallback },
  set(key, value) { state[key] = value; write() },

  // Vygenerované varianty si pamatujeme, aby odkaz #/u/4/gen-… přežil obnovení stránky.
  saveGenerated(task) {
    state.gen ??= {}
    state.gen[task.id] = { task, at: Date.now() }
    const ids = Object.keys(state.gen).sort((a, b) => state.gen[b].at - state.gen[a].at)
    for (const id of ids.slice(40)) delete state.gen[id]
    write()
  },
  generated(id) { return state.gen?.[id]?.task },
}
