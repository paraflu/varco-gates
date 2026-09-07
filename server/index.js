import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { createToken, listTokens, revokeToken, getValidToken } from './db.js'
import { GATES, haCallService, gateById } from './ha.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const COOKIE_SECRET = process.env.COOKIE_SECRET || ADMIN_PASSWORD
const isProd = process.env.NODE_ENV === 'production'

app.use(express.json())

// --- Cookie session admin: firma HMAC sul valore (timestamp + nonce) ---
// No token salvati lato Express: solo il flag "loggato" con scadenza.
// Il nonce e' random per evitare fixation, il timestamp firmato per scadenza.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function signSession(expiresAt) {
  const nonce = randomBytes(16).toString('hex')
  const payload = `${expiresAt}.${nonce}`
  const sig = createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function verifySession(value) {
  if (!value || typeof value !== 'string') return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [expiresAt, nonce, sig] = parts
  if (!/^\d+$/.test(expiresAt)) return null
  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return null
  const expected = createHmac('sha256', COOKIE_SECRET).update(`${expiresAt}.${nonce}`).digest('hex')
  if (expected.length !== sig.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))) return null
  } catch {
    return null
  }
  return { expiresAt: Number(expiresAt) }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' })
  const cookie = req.cookies?.vg_session
  const session = verifySession(cookie)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

// --- Cookie parser minimale (Express non lo abilita di default) ---
app.use((req, _res, next) => {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('='))
  }
  req.cookies = out
  next()
})

// --- CSRF: richiede header custom su tutte le POST/DELETE/PUT/PATCH ---
// Same-origin non lo richiederebbe, ma e' una difesa in profondita' economica.
function requireCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const sent = req.headers['x-requested-with']
  if (sent !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Missing X-Requested-With header' })
  }
  next()
}

app.use(requireCsrf)

// --- Auth admin (login / logout) ---

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {}
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
    return res.status(400).json({ error: 'password required' })
  }
  if (password !== ADMIN_PASSWORD) {
    // risposta costante nel tempo per evitare timing oracle
    return setTimeout(() => res.status(401).json({ error: 'Invalid credentials' }), 200)
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 8 // 8 ore
  const cookie = signSession(expiresAt)
  res.cookie('vg_session', cookie, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
  })
  res.json({ ok: true, expiresAt })
})

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('vg_session', { path: '/' })
  res.json({ ok: true })
})

// --- Token guest (per link condivisi col vicino) ---
// Rimane invariato: il token e' random, non riusabile come sessione admin.

app.post('/api/admin/tokens', requireAdmin, (req, res) => {
  const body = req.body || {}
  const ttl = Number(body.ttl_seconds)
  if (!Number.isFinite(ttl)) return res.status(400).json({ error: 'ttl_seconds must be a number' })
  if (ttl < 60 || ttl > 31536000) return res.status(400).json({ error: 'ttl_seconds must be 60..31536000' })
  const t = createToken({ label: String(body.label || '').slice(0, 64), ttlSeconds: ttl })
  res.json(t)
})

app.get('/api/admin/tokens', requireAdmin, (_req, res) => {
  // Escludo il campo token dalla lista (non serve al client, evita leak via XSS)
  const rows = listTokens().map(({ token, ...rest }) => ({
    ...rest,
    token_prefix: token.slice(0, 6) + '…' + token.slice(-4)
  }))
  res.json({ tokens: rows })
})

app.delete('/api/admin/tokens/:id', requireAdmin, (req, res) => {
  revokeToken(Number(req.params.id))
  res.json({ ok: true })
})

// --- Guest: link condiviso ---
// /api/verify/:token: il guest conosce il token (lo ha nel link). Resta in URL
// perche' e' l'unico modo per un link statico; ma il client non deve loggarlo.
// /api/control: il guest manda il token nel body.

app.get('/api/verify/:token', (req, res) => {
  if (!getValidToken(req.params.token)) return res.status(403).json({ error: 'Token non valido o scaduto' })
  res.json({ valid: true, gates: GATES.map(g => ({ id: g.id, label: g.label })) })
})

app.post('/api/control', async (req, res) => {
  const body = req.body || {}
  if (!getValidToken(body.token)) return res.status(403).json({ error: 'Token non valido o scaduto' })
  if (!body.action) return res.status(400).json({ error: 'action is required' })
  const gate = gateById(body.gate)
  if (!gate) return res.status(400).json({ error: 'gate sconosciuto' })
  try {
    await haCallService(gate.entityId, body.action)
    res.json({ ok: true, gate: body.gate, action: body.action })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// --- Static frontend ---

const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')))
}

app.listen(PORT, '0.0.0.0', () => console.log(`varco-gates on :${PORT}`))
