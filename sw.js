// Vygenerováno nástrojem tools/build-sw.mjs – needitovat ručně.
const VERSION = 'prpa-d53e0d103b'
const FILES = [
  "./",
  "css/app.css",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon.svg",
  "index.html",
  "js/data/prpa.js",
  "js/data/teorie.js",
  "js/data/uloha1.js",
  "js/data/uloha2.js",
  "js/data/uloha3.js",
  "js/data/uloha4.js",
  "js/hs/compile.js",
  "js/hs/errors.js",
  "js/hs/exprtools.js",
  "js/hs/index.js",
  "js/hs/lexer.js",
  "js/hs/parser.js",
  "js/hs/prelude.js",
  "js/hs/runtime.js",
  "js/hs/scope.js",
  "js/hs/types.js",
  "js/ui/app.js",
  "js/ui/dom.js",
  "js/ui/editor.js",
  "js/ui/exam.js",
  "js/ui/hsx.js",
  "js/ui/konzole.js",
  "js/ui/lists.js",
  "js/ui/store.js",
  "js/ui/tahak.js",
  "js/ui/u1.js",
  "js/ui/u2.js",
  "js/ui/u34.js",
  "manifest.webmanifest"
]

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
