<template>
  <div class="container mt-5" style="max-width: 760px">
    <h1 class="h3 mb-4">Admin - Token Cancelli</h1>

    <div v-if="!authed" class="card">
      <div class="card-body">
        <h5 class="card-title">Login</h5>
        <div class="input-group">
          <input type="password" class="form-control" v-model="password"
            placeholder="Password amministratore" @keyup.enter="login" />
          <button class="btn btn-primary" @click="login">Accedi</button>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="card-title">Genera nuovo token</h5>
          <div class="row g-2">
            <div class="col-md-4">
              <input class="form-control" v-model="label" placeholder="Etichetta (es. Consegna)" />
            </div>
            <div class="col-md-4">
              <select class="form-select" v-model="ttl">
                <option :value="3600">1 ora</option>
                <option :value="7200">2 ore</option>
                <option :value="86400">24 ore</option>
                <option :value="604800">7 giorni</option>
                <option :value="2592000">30 giorni</option>
              </select>
            </div>
            <div class="col-md-4">
              <button class="btn btn-success w-100" :disabled="creating" @click="create">Genera</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="newUrl" class="alert alert-info">
        <strong>URL di accesso:</strong><br />
        <input class="form-control mt-1" readonly :value="newUrl" @focus="$event.target.select()" />
      </div>

      <h5 class="mb-2">Token attivi</h5>
      <table class="table table-sm table-striped">
        <thead><tr><th>Etichetta</th><th>Token</th><th>Scadenza</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in tokens" :key="t.id">
            <td>{{ t.label || '-' }}</td>
            <td><code class="small">{{ shortToken(t.token) }}</code></td>
            <td :class="{ 'text-danger': t.expired }">{{ fmt(t.expires_at) }}</td>
            <td><button class="btn btn-sm btn-outline-danger" @click="revoke(t.id)">Revoca</button></td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const password = ref('')
const authed = ref(false)
const label = ref('')
const ttl = ref(3600)
const tokens = ref([])
const newUrl = ref('')
const creating = ref(false)

function shortToken(t) { return t.slice(0, 12) + '...' }
function fmt(iso) { return new Date(iso).toLocaleString('it-IT') }

function authHeader() { return { 'Authorization': 'Bearer ' + password.value } }

async function login() {
  const r = await fetch('/api/admin/tokens', { headers: authHeader() })
  if (r.ok) { authed.value = true; await load() }
  else alert('Password errata')
}

async function load() {
  const r = await fetch('/api/admin/tokens', { headers: authHeader() })
  tokens.value = (await r.json()).tokens
}

async function create() {
  creating.value = true
  try {
    const r = await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.value, ttl_seconds: ttl.value })
    })
    const data = await r.json()
    if (r.ok) {
      newUrl.value = location.origin + '/' + data.token
      label.value = ''
      await load()
    } else alert(data.error || 'Errore')
  } finally { creating.value = false }
}

async function revoke(id) {
  await fetch('/api/admin/tokens/' + id, { method: 'DELETE', headers: authHeader() })
  await load()
}

onMounted(() => { /* login on demand */ })
</script>

