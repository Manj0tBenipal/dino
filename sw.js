// Cache name is fixed — no version bumping needed
// Content changes are detected via SHA-256 checksum of each response body
const CACHE     = 'dinorun';
const HASH_STORE = 'dinorun-hashes';  // separate cache used as a k/v hash store

// Compute SHA-256 of an ArrayBuffer, return first 16 hex chars
async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// Read stored hash for a URL from the hash store cache
async function getStoredHash(url) {
  const store = await caches.open(HASH_STORE);
  const res   = await store.match(url);
  return res ? await res.text() : null;
}

// Write hash for a URL into the hash store cache
async function setStoredHash(url, hash) {
  const store = await caches.open(HASH_STORE);
  await store.put(url, new Response(hash));
}

// Install — skip waiting so new SW activates immediately
self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// Fetch — checksum-aware cache strategy
self.addEventListener('fetch', e => {
  // only handle same-origin GET requests
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(handleRequest(e.request));
});

async function handleRequest(request) {
  const cache = await caches.open(CACHE);

  // try network first
  let networkRes;
  try {
    networkRes = await fetch(request);
  } catch {
    // offline — fall back to cache
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }

  // clone body — we need to read it twice (hash + cache)
  const buffer  = await networkRes.clone().arrayBuffer();
  const newHash = await sha256(buffer);
  const oldHash = await getStoredHash(request.url);

  if (newHash !== oldHash) {
    // content changed (or first visit) — update cache and stored hash
    console.log(`[SW] updated: ${request.url} (${oldHash ?? 'new'} → ${newHash})`);
    await cache.put(request, networkRes.clone());
    await setStoredHash(request.url, newHash);
  }

  // return fresh network response
  return networkRes;
}