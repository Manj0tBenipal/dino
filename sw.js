const CACHE = 'dinorun-v2';
const ASSETS = [
  './', './index.html', './style.css', './game.js', './manifest.json',
  './sounds/player-jump.mp3', './sounds/ai-jump.mp3', './sounds/dead.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});