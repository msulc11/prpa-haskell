// Vygeneruje sw.js se seznamem souborů pro offline režim a verzí podle jejich obsahu.
// Spouštět před každým nasazením: node tools/build-sw.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const include = ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'css', 'js']

function walk(p) {
  const full = join(root, p)
  if (statSync(full).isDirectory()) return readdirSync(full).flatMap(f => walk(join(p, f)))
  return [p]
}

const files = include.flatMap(walk).map(f => f.split(sep).join('/')).sort()
const hash = createHash('sha256')
for (const f of files) hash.update(f).update(readFileSync(join(root, f)))
const version = 'prpa-' + hash.digest('hex').slice(0, 10)

const sw = `// Vygenerováno nástrojem tools/build-sw.mjs – needitovat ručně.
const VERSION = '${version}'
const FILES = ${JSON.stringify(['./', ...files], null, 2)}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

// Nejdřív z mezipaměti (funguje offline), na pozadí se stáhne čerstvá verze.
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true })
    const net = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone())
      return res
    }).catch(() => hit)
    return hit || net
  }))
})
`
writeFileSync(join(root, 'sw.js'), sw)
console.log(`sw.js: ${files.length} souborů, verze ${version}`)
