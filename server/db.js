import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(join(DATA_DIR, 'varco.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
  );
`)

export function createToken({ label, ttlSeconds }) {
  const token = randomToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
  db.prepare('INSERT INTO tokens (token, label, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, label, now.toISOString(), expiresAt.toISOString())
  return { token, label, created_at: now.toISOString(), expires_at: expiresAt.toISOString() }
}

export function listTokens() {
  return db.prepare(
    'SELECT id, token, label, created_at, expires_at, revoked, ' +
    'CASE WHEN expires_at <= ? THEN 1 ELSE 0 END AS expired FROM tokens ORDER BY created_at DESC'
  ).all(new Date().toISOString())
}

export function revokeToken(id) {
  db.prepare('UPDATE tokens SET revoked = 1 WHERE id = ?').run(id)
}

export function getValidToken(token) {
  const row = db.prepare('SELECT * FROM tokens WHERE token = ?').get(token)
  if (!row) return null
  if (row.revoked) return null
  if (new Date(row.expires_at) <= new Date()) return null
  return row
}

function randomToken() {
  return randomBytes(24).toString('hex')
}