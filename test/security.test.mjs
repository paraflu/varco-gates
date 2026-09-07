// TDD security tests per varco-gates — node:test, zero dipendenze.
// Run: npm test  (avvia il server su porta effimera con env di test)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 3998
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_PW = 'test-admin-pass'
const COOKIE_SECRET = 'a'.repeat(64)

let proc
let dataDir
let adminCookie = ''

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'vg-test-'))
  proc = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      ADMIN_PASSWORD: ADMIN_PW,
      COOKIE_SECRET: COOKIE_SECRET,
      HA_BASE_URL: 'http://127.0.0.1:1', // porta irraggiungibile: HA assente
      DATA_DIR: dataDir
    },
    stdio: 'ignore'
  })
  // attende readiness
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/')
      if (r.ok) return
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('server non pronto')
})

after(() => {
  proc?.kill()
  rmSync(dataDir, { recursive: true, force: true })
})

const XHR = { 'X-Requested-With': 'XMLHttpRequest' }
const JSONH = { ...XHR, 'Content-Type': 'application/json' }

async function login(password) {
  return fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: JSONH,
    body: JSON.stringify({ password })
  })
}

function cookieFrom(res) {
  return res.headers.get('set-cookie')?.split(';')[0] || ''
}

async function createToken(cookie, label = 'tdd') {
  const r = await fetch(BASE + '/api/admin/tokens', {
    method: 'POST',
    headers: { ...JSONH, cookie },
    body: JSON.stringify({ label, ttl_seconds: 3600 })
  })
  assert.equal(r.status, 200, 'creazione token deve riuscire')
  return r.json()
}

// --- CSRF ---

test('POST senza X-Requested-With → 403 (CSRF block)', async () => {
  const r2 = await fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PW })
  })
  assert.equal(r2.status, 403)
})

// --- Login ---

test('login con password errata → 401', async () => {
  const r = await login('wrong-password')
  assert.equal(r.status, 401)
})

test('login corretta → 200 e cookie vg_session httpOnly', async () => {
  const r = await login(ADMIN_PW)
  assert.equal(r.status, 200)
  const sc = r.headers.get('set-cookie') || ''
  assert.match(sc, /vg_session=/)
  assert.match(sc, /HttpOnly/i)
  assert.match(sc, /SameSite=Strict/i)
  adminCookie = cookieFrom(r)
})

// --- Token + control (usano il cookie ottenuto nel test login) ---

test('verify con token valido → 200 + lista gates', async () => {
  const cookie = adminCookie
  const { token } = await createToken(cookie, 'verify-tdd')
  const r = await fetch(`${BASE}/api/verify/${token}`)
  assert.equal(r.status, 200)
  const data = await r.json()
  assert.equal(data.valid, true)
  assert.ok(Array.isArray(data.gates) && data.gates.length >= 2)
})

test('verify con token invalido → 403', async () => {
  const r = await fetch(BASE + '/api/verify/not-a-real-token-000000000000')
  assert.equal(r.status, 403)
})

test('SECURITY: action path traversal verso API HA → 400 (whitelist)', async () => {
  const cookie = adminCookie
  const { token } = await createToken(cookie, 'traversal-tdd')
  const r = await fetch(BASE + '/api/control', {
    method: 'POST',
    headers: JSONH,
    body: JSON.stringify({ token, gate: 'andrea', action: '../../services/light/turn_on' })
  })
  assert.equal(r.status, 400)
  assert.equal((await r.json()).error, 'action non permessa')
})

test('SECURITY: action arbitraria "delete_entity" → 400', async () => {
  const cookie = adminCookie
  const { token } = await createToken(cookie, 'badaction-tdd')
  const r = await fetch(BASE + '/api/control', {
    method: 'POST',
    headers: JSONH,
    body: JSON.stringify({ token, gate: 'andrea', action: 'delete_entity' })
  })
  assert.equal(r.status, 400)
})

test('control con action valida e HA irraggiungibile → 502 con errore generico (no leak)', async () => {
  const cookie = adminCookie
  const { token } = await createToken(cookie, 'leak-tdd')
  const r = await fetch(BASE + '/api/control', {
    method: 'POST',
    headers: JSONH,
    body: JSON.stringify({ token, gate: 'andrea', action: 'toggle' })
  })
  assert.equal(r.status, 502)
  const body = await r.json()
  assert.ok(!/econnrefused|connect|192\.168|8123/i.test(body.error), 'non deve leakare dettagli HA')
})

test('control con token invalido → 403', async () => {
  const r = await fetch(BASE + '/api/control', {
    method: 'POST',
    headers: JSONH,
    body: JSON.stringify({ token: 'fake-token-aaaaaaaaaaaa', gate: 'andrea', action: 'toggle' })
  })
  assert.equal(r.status, 403)
})

// --- Password timing-safe (funzionale: password vuota/mancante → 400) ---

test('login senza password → 400', async () => {
  const r = await fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: JSONH,
    body: JSON.stringify({})
  })
  assert.equal(r.status, 400)
})

// --- Admin protetto ---

test('endpoint admin senza sessione → 401', async () => {
  const r = await fetch(BASE + '/api/admin/tokens', { headers: XHR })
  assert.equal(r.status, 401)
})

// --- Rate limit (ULTIMO: esaurisce i tentativi per IP e blocca i login successivi) ---

test('rate limit: dopo 10 fail → 429', async () => {
  // 10 tentativi sbagliati
  for (let i = 0; i < 10; i++) await login('bad-' + i)
  const r = await login('bad-final')
  assert.equal(r.status, 429)
})
