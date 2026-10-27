// Pomocné funkce pro ověřování obsahu proti skutečnému GHC.
// Používá se jen lokálně (tests/content-ghc.test.js), na web se nenasazuje.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, cpus } from 'node:os'

const GHC_DIR = process.env.GHC_BIN ||
  'C:/Users/matej/ghc-9.12.4-x86_64-unknown-mingw32-int_native/ghc-9.12.4-x86_64-unknown-mingw32/bin'
export const GHC = join(GHC_DIR, process.platform === 'win32' ? 'ghc.exe' : 'ghc')

const SCRATCH = 'C:/Users/matej/AppData/Local/Temp/claude/C--Users-matej-Desktop-prpa/2aab20d0-6c0b-4b66-8668-90811514dfa9/scratchpad'
export const WORK = join(process.env.CONTENT_WORK || (existsSync(SCRATCH) ? SCRATCH : tmpdir()), 'content-ghc')

export function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { ...opts, windowsHide: true })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    const timer = opts.timeout ? setTimeout(() => p.kill(), opts.timeout) : null
    p.on('close', (code) => { if (timer) clearTimeout(timer); resolve({ code, out }) })
    p.on('error', (e) => resolve({ code: -1, out: String(e) }))
  })
}

export async function pool(items, n, fn) {
  const res = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k) }
  })
  await Promise.all(workers)
  return res
}

// sjednotí uvozovky a bílé znaky, aby šlo porovnat hlášky GHC (`x' vs ‘x’)
export function normMsg(s) {
  return s.replace(/[`‘’']/g, "'").replace(/[•*:]/g, ' ').replace(/\s+/g, ' ').trim()
}

let dirCounter = 0
function freshDir(tag) {
  const d = join(WORK, `${tag}-${process.pid}-${Date.now()}-${dirCounter++}`)
  mkdirSync(d, { recursive: true })
  return d
}

// Zkusí přeložit kód jako modul (bez main). Vrací { ok, out }.
export async function typecheck(code, tag = 'tc') {
  const d = freshDir(tag)
  const f = join(d, 'Bug.hs')
  writeFileSync(f, 'module Bug where\n' + code + '\n')
  const r = await run(GHC, ['-fno-code', '-v0', f], { cwd: d, timeout: 120000 })
  rmSync(d, { recursive: true, force: true })
  return { ok: r.code === 0, out: r.out }
}

// Vyhodnotí výraz v GHCi nad daným modulem (pro chyby, co se projeví až při volání).
export async function ghciEval(code, expr) {
  const d = freshDir('ev')
  const f = join(d, 'Bug.hs')
  writeFileSync(f, 'module Bug where\n' + code + '\n')
  const r = await run(GHC, ['-v0', f, '-e', expr], { cwd: d, timeout: 120000 })
  rmSync(d, { recursive: true, force: true })
  return { ok: r.code === 0 && !/error/.test(r.out), out: r.out }
}

// Dávkové vyhodnocení: entries = [{ key, code, exprs: [string] }]
// Každý kód se přeloží jako samostatný modul, výrazy se vyhodnotí s ExtendedDefaultRules
// (stejné defaultování jako v GHCi) a vytisknou přes show.
// Vrací { ok, compileOut, results: Map(key -> [{ ok, value } | { ok:false, err }]) }
export async function evalBatch(entries, tag = 'batch') {
  const d = freshDir(tag)
  const imports = []
  const runs = []
  entries.forEach((e, i) => {
    const s = `S${i}`, t = `T${i}`
    writeFileSync(join(d, s + '.hs'), `module ${s} where\n${e.code || ''}\n`)
    const list = e.exprs.map((x) => `show (${x})`).join(',\n  ')
    writeFileSync(join(d, t + '.hs'),
      `{-# LANGUAGE ExtendedDefaultRules #-}\n{-# OPTIONS_GHC -Wno-type-defaults #-}\nmodule ${t} (results) where\nimport ${s}\nresults :: [String]\nresults =\n  [ ${list}\n  ]\n`)
    imports.push(`import qualified ${t}`)
    runs.push(`  runAll ${JSON.stringify(String(i))} ${t}.results`)
  })
  const main = `{-# LANGUAGE ScopedTypeVariables #-}
module Main where
import Control.Exception
import System.Timeout
import System.IO
${imports.join('\n')}

one :: String -> Int -> String -> IO ()
one k i s = do
  r <- timeout 3000000 (try (evaluate (length s \`seq\` s)))
  let p = k ++ "\\t" ++ show i ++ "\\t"
  case r of
    Nothing -> putStrLn (p ++ "ERR timeout")
    Just (Left (e :: SomeException)) -> putStrLn (p ++ "ERR " ++ map (\\c -> if c == '\\n' then ' ' else c) (show e))
    Just (Right v) -> putStrLn (p ++ "OK " ++ v)

runAll :: String -> [String] -> IO ()
runAll k xs = mapM_ (\\(i, s) -> one k i s) (zip [0..] xs)

main :: IO ()
main = do
  hSetEncoding stdout utf8
${runs.join('\n') || '  return ()'}
`
  writeFileSync(join(d, 'Main.hs'), main)
  const exe = join(d, process.platform === 'win32' ? 'run.exe' : 'run')
  const jobs = Math.max(2, Math.min(8, cpus().length))
  const c = await run(GHC, ['--make', `-j${jobs}`, '-O0', '-v0', `-i${d}`, '-outputdir', join(d, 'build'), '-o', exe, join(d, 'Main.hs')],
    { cwd: d, timeout: 900000 })
  if (c.code !== 0) {
    // přeložíme chybové hlášky S12/T12 zpět na klíče
    const out = c.out.replace(/[ST](\d+)\.hs/g, (m, n) => `${m}[${entries[+n]?.key}]`)
    return { ok: false, compileOut: out, results: new Map(), dir: d }
  }
  const r = await run(exe, [], { cwd: d, timeout: 600000 })
  const results = new Map(entries.map((e) => [e.key, []]))
  for (const line of r.out.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\t(\d+)\t(OK|ERR) ?(.*)$/)
    if (!m) continue
    const key = entries[+m[1]].key
    results.get(key)[+m[2]] = m[3] === 'OK' ? { ok: true, value: m[4] } : { ok: false, err: m[4] }
  }
  rmSync(d, { recursive: true, force: true })
  return { ok: true, compileOut: '', results }
}

// deterministický generátor náhodných čísel pro testy generátorů
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
