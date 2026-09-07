// SMTP alerts. Usa SMTP_HOST/PORT/USER/PASS/FROM/TO se settati.
// Se non configurato, gli alert vengono solo loggati (no throw).

import { createTransport } from 'nodemailer'

let transporter = null

function getTransporter() {
  if (transporter !== null) return transporter
  const host = process.env.SMTP_HOST
  if (!host) {
    transporter = false // disabled
    return false
  }
  transporter = createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  })
  return transporter
}

export async function sendAlert({ subject, text }) {
  const t = getTransporter()
  if (!t) {
    console.warn('[alert]', subject, '\n', text)
    return
  }
  const from = process.env.ALERT_FROM || process.env.SMTP_USER || 'varco-gates@localhost'
  const to = process.env.ALERT_TO || from
  try {
    await t.sendMail({ from, to, subject, text })
  } catch (e) {
    console.error('alert send failed', e?.message)
  }
}
