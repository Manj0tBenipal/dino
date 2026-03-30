// Cache name is fixed — content changes detected via SHA-256 checksum
const CACHE      = 'dinorun-v2'
const HASH_STORE = 'dinorun-hashes'

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

async function getStoredHash(url) {
  const store = await caches.open(HASH_STORE)
  const res   = await store.match(url)
  return res ? await res.text() : null
}

async function setStoredHash(url, hash) {
  const store = await caches.open(HASH_STORE)
  await store.put(url, new Response(hash))
}

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  e.respondWith(handleRequest(e.request))
})

async function handleRequest(request) {
  const cache = await caches.open(CACHE)

  let networkRes
  try {
    networkRes = await fetch(request)
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response('Offline', { status: 503 })
  }

  const buffer  = await networkRes.clone().arrayBuffer()
  const newHash = await sha256(buffer)
  const oldHash = await getStoredHash(request.url)

  if (newHash !== oldHash) {
    console.log(`[SW] updated: ${request.url}`)
    await cache.put(request, networkRes.clone())
    await setStoredHash(request.url, newHash)
  }

  return networkRes
}
