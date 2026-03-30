import http    from 'http'
import fs      from 'fs'
import path    from 'path'
import { WebSocketServer } from 'ws'
import { GameLoop }        from './gameLoop'

const PORT       = parseInt(process.env.PORT ?? '3000', 10)
const PUBLIC_DIR = path.resolve(process.cwd(), 'public')
const ROOT_DIR   = process.cwd()

// Static asset MIME types
const MIME: Record<string, string> = {
  '.html':        'text/html; charset=utf-8',
  '.css':         'text/css',
  '.js':          'application/javascript',
  '.json':        'application/json',
  '.webmanifest': 'application/manifest+json',
  '.mp3':         'audio/mpeg',
  '.png':         'image/png',
  '.ico':         'image/x-icon',
}

// Directories at the project root that are safe to serve as fallback.
// This lets /sounds/ and /icons/ work without copying them into public/.
const ROOT_PASSTHROUGH = ['/sounds/', '/icons/']

function serveFile(filePath: string, res: http.ServerResponse) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }
    const ext         = path.extname(filePath).toLowerCase()
    const contentType = MIME[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
}

// ── HTTP server ───────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  let urlPath = req.url ?? '/'
  // Strip query string
  const qIdx = urlPath.indexOf('?')
  if (qIdx !== -1) urlPath = urlPath.slice(0, qIdx)

  if (urlPath === '/') urlPath = '/index.html'

  // Resolve to an absolute path and guard against directory traversal
  const publicFile = path.resolve(PUBLIC_DIR, urlPath.slice(1))
  if (!publicFile.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden')
    return
  }

  // Try public/ first
  if (fs.existsSync(publicFile)) {
    serveFile(publicFile, res)
    return
  }

  // Fallback to project root for /sounds/ and /icons/ only
  const isPassthrough = ROOT_PASSTHROUGH.some(p => urlPath.startsWith(p))
  if (isPassthrough) {
    const rootFile = path.resolve(ROOT_DIR, urlPath.slice(1))
    // Extra guard: must still be under root and in an allowed subdirectory
    if (rootFile.startsWith(ROOT_DIR) && fs.existsSync(rootFile)) {
      serveFile(rootFile, res)
      return
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

// ── WebSocket server ──────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer })

// One shared game loop — all connected clients observe the same simulation.
// Any client can control the human dino (first to press wins).
const game = new GameLoop()

const TICK_MS = 1000 / 60  // ~16.67 ms → 60 fps

setInterval(() => {
  const state = game.tick()
  const msg   = JSON.stringify(state)
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg)
    }
  }
}, TICK_MS)

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress ?? 'unknown'
  console.log(`[ws] client connected  — ${ip}  (${wss.clients.size} total)`)

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (typeof msg.type === 'string') {
        game.handleInput(msg.type)
      }
    } catch {
      // ignore malformed messages
    }
  })

  ws.on('close', () => {
    console.log(`[ws] client disconnected — ${ip}  (${wss.clients.size} remaining)`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`DinoRun server → http://localhost:${PORT}`)
})
