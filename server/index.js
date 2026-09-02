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

app.use(express.json())

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' })
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

app.post('/api/admin/tokens', requireAdmin, (req, res) => {
  const body = req.body || {}
  const ttl = Number(body.ttl_seconds)
  if (!Number.isFinite(ttl)) return res.status(400).json({ error: 'ttl_seconds must be a number' })
  if (ttl < 60 || ttl > 31536000) return res.status(400).json({ error: 'ttl_seconds must be 60..31536000' })
  const t = createToken({ label: String(body.label || ''), ttlSeconds: ttl })
  res.json(t)
})

app.get('/api/admin/tokens', requireAdmin, (_req, res) => {
  res.json({ tokens: listTokens() })
})

app.delete('/api/admin/tokens/:id', requireAdmin, (req, res) => {
  revokeToken(Number(req.params.id))
  res.json({ ok: true })
})

app.get('/api/verify/:token', (req, res) => {
  if (!getValidToken(req.params.token)) return res.status(403).json({ error: 'Token non valido o scaduto' })
  res.json({ valid: true, gates: GATES.map(g => ({ id: g.id, label: g.label })) })
})

app.post('/api/control', async (req, res) => {
  const body = req.body || {}
  if (!getValidToken(body.token)) return res.status(403).json({ error: 'Token non valido o scaduto' })
  if (body.action !== 'open' && body.action !== 'close') return res.status(400).json({ error: 'action must be open o close' })
  const gate = gateById(body.gate)
  if (!gate) return res.status(400).json({ error: 'gate sconosciuto' })
  try {
    const svc = body.action === 'open' ? 'turn_on' : 'turn_off'
    await haCallService(gate.entityId, svc)
    res.json({ ok: true, gate: body.gate, action: body.action })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')))
}

app.listen(PORT, '0.0.0.0', () => console.log(`varco-gates on :${PORT}`))

