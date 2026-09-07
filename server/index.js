import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  createToken, listTokens, revokeToken, getValidToken,
  writeAudit, listAudit, countAuditSince
} from './db.js'
import { GATES, haCallService, gateById } from './ha.js'
import { sendAlert } from './notify.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const COOKIE_SECRET = process.env.COOKIE_SECRET || ADMIN_PASSWORD
const isProd = process.env.NODE_ENV === 'production'

// Express: fidati di X-Forwarded-For dal proxy (NPM) per l'IP corretto
app.set('trust proxy', 1)
app.use(express.json())

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

// --- Sessione admin via cookie firmato HMAC ---
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

function clientIp(req) {
  return (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '')
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' })
  const cookie = req.cookies?.vg_session
  const session = verifySession(cookie)
  if (!session) {
    writeAudit({ kind: 'admin_unauthorized', actor: '', ip: clientIp(req), result: 'fail', detail: req.method + ' ' + req.path })
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

function requireCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const sent = req.headers['x-requested-with']
  if (sent !== 'XMLHttpRequest') {
    writeAudit({ kind: 'csrf_block', actor: '', ip: clientIp(req), result: 'fail', detail: req.method + ' ' + req.path })
    return res.status(403).json({ error: 'Missing X-Requested-With header' })
  }
  next()
}

app.use(requireCsrf)

// --- Helper: token prefix da stringa completa ---
function tokenPrefix(t) {
  if (!t || t.length < 10) return ''
  return t.slice(0, 6) + '…' + t.slice(-4)
}

// --- Auth admin ---

app.post('/api/admin/login', (req, res) => {
  const ip = clientIp(req)
  const { password } = req.body || {}
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
    writeAudit({ kind: 'admin_login_fail', actor: '', ip, result: 'fail', detail: 'empty or oversized password' })
    return res.status(400).json({ error: 'password required' })
  }
  if (password !== ADMIN_PASSWORD) {
    writeAudit({ kind: 'admin_login_fail', actor: '', ip, result: 'fail', detail: 'wrong password' })
    // Rate limit alert: >= 5 fail in 5 minuti
    const fails = countAuditSince('admin_login_fail', 5)
    if (fails >= 5 && fails % 5 === 0) {
      sendAlert({
        subject: `[varco-gates] ${fails} login admin falliti in 5 min da ${ip}`,
        text: `IP: ${ip}\nTimestamp: ${new Date().toISOString()}\nTotale fallimenti recenti: ${fails}`
      })
    }
    return setTimeout(() => res.status(401).json({ error: 'Invalid credentials' }), 200)
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 8
  const cookie = signSession(expiresAt)
  res.cookie('vg_session', cookie, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
  })
  writeAudit({ kind: 'admin_login_ok', actor: 'admin', ip, result: 'ok', detail: 'sessione 8h' })
  res.json({ ok: true, expiresAt })
})

app.post('/api/admin/logout', (req, res) => {
  const ip = clientIp(req)
  writeAudit({ kind: 'admin_logout', actor: 'admin', ip, result: 'ok' })
  res.clearCookie('vg_session', { path: '/' })
  res.json({ ok: true })
})

// --- Token guest admin ---

app.post('/api/admin/tokens', requireAdmin, (req, res) => {
  const ip = clientIp(req)
  const body = req.body || {}
  const ttl = Number(body.ttl_seconds)
  if (!Number.isFinite(ttl)) return res.status(400).json({ error: 'ttl_seconds must be a number' })
  if (ttl < 60 || ttl > 31536000) return res.status(400).json({ error: 'ttl_seconds must be 60..31536000' })
  const label = String(body.label || '').slice(0, 64)
  const t = createToken({ label, ttlSeconds: ttl })
  writeAudit({ kind: 'token_create', actor: 'admin', ip, result: 'ok', detail: `label="${label}" ttl=${ttl}s id=${t.token.slice(0, 8)}…` })
  res.json(t)
})

app.get('/api/admin/tokens', requireAdmin, (_req, res) => {
  const rows = listTokens().map(({ token, ...rest }) => ({
    ...rest,
    token_prefix: tokenPrefix(token)
  }))
  res.json({ tokens: rows })
})

app.delete('/api/admin/tokens/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const ip = clientIp(req)
  revokeToken(id)
  writeAudit({ kind: 'token_revoke', actor: 'admin', ip, result: 'ok', detail: `id=${id}` })
  res.json({ ok: true })
})

// --- Audit endpoint (solo admin) ---

app.get('/api/admin/audit', requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const kind = typeof req.query.kind === 'string' ? req.query.kind : ''
  const sinceMinutes = Number(req.query.since_minutes) || 0
  const rows = listAudit({ limit, kind, sinceMinutes })
  res.json({ events: rows })
})

// --- Guest: link condiviso ---

app.get('/api/verify/:token', (req, res) => {
  const ip = clientIp(req)
  const t = req.params.token
  const valid = !!getValidToken(t)
  writeAudit({
    kind: valid ? 'gate_verify_ok' : 'gate_verify_fail',
    actor: tokenPrefix(t),
    ip,
    result: valid ? 'ok' : 'fail'
  })
  if (!valid) return res.status(403).json({ error: 'Token non valido o scaduto' })
  res.json({ valid: true, gates: GATES.map(g => ({ id: g.id, label: g.label })) })
})

app.post('/api/control', async (req, res) => {
  const ip = clientIp(req)
  const body = req.body || {}
  const t = body.token
  const tokenRow = t ? getValidToken(t) : null
  if (!tokenRow) {
    writeAudit({
      kind: 'gate_control_fail', actor: tokenPrefix(t || ''), ip,
      result: 'fail', detail: 'token non valido'
    })
    return res.status(403).json({ error: 'Token non valido o scaduto' })
  }
  if (!body.action) {
    writeAudit({
      kind: 'gate_control_fail', actor: tokenPrefix(t), ip,
      result: 'fail', detail: 'action mancante'
    })
    return res.status(400).json({ error: 'action is required' })
  }
  const gate = gateById(body.gate)
  if (!gate) {
    writeAudit({
      kind: 'gate_control_fail', actor: tokenPrefix(t), ip,
      result: 'fail', detail: `gate sconosciuto: ${String(body.gate).slice(0, 32)}`
    })
    return res.status(400).json({ error: 'gate sconosciuto' })
  }
  try {
    await haCallService(gate.entityId, body.action)
    writeAudit({
      kind: 'gate_control_ok', actor: tokenPrefix(t), ip,
      result: 'ok', detail: `gate=${body.gate} action=${body.action} label="${tokenRow.label}"`
    })
    res.json({ ok: true, gate: body.gate, action: body.action })
  } catch (e) {
    writeAudit({
      kind: 'gate_control_fail', actor: tokenPrefix(t), ip,
      result: 'fail', detail: `gate=${body.gate} action=${body.action} err="${String(e.message).slice(0, 120)}"`
    })
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
