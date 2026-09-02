export const GATES = [
  {
    id: 'andrea',
    label: 'Cancello Andrea',
    entityId: process.env.GATE_ANDREA_ENTITY || 'switch.sonoff_1002658c25_1'
  },
  {
    id: 'alessandro',
    label: 'Cancello Alessandro',
    entityId: process.env.GATE_ALESSANDRO_ENTITY || 'switch.sonoff_1002592ef9_1'
  }
]

const HA_BASE_URL = process.env.HA_BASE_URL || 'http://192.168.3.27:8123'
const HA_TOKEN = process.env.HA_TOKEN || ''

export async function haCallService(entityId, service) {
  const res = await fetch(`${HA_BASE_URL}/api/services/switch/${service}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ entity_id: entityId })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HA ${service} failed: ${res.status} ${text}`)
  }
  return true
}

export function gateById(id) {
  return GATES.find(g => g.id === id)
}