<template>
  <div class="max-w-xl mx-auto mt-12">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Admin - Token Cancelli</h1>
      <button
        v-if="authed"
        @click="logout"
        class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
      >Esci</button>
    </div>

    <div v-if="!authed" class="bg-white rounded-lg shadow-md p-6">
      <h5 class="text-lg font-semibold mb-4">Login</h5>
      <div class="flex mb-4">
        <input 
          type="password" 
          class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          v-model="password"
          placeholder="Password amministratore"
          @keyup.enter="login"
        />
        <button 
          class="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 focus:outline-none"
          @click="login"
        >
          Accedi
        </button>
      </div>
    </div>

    <template v-else>
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h5 class="text-lg font-semibold mb-4">Genera nuovo token</h5>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <input 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              v-model="label"
              placeholder="Etichetta (es. Consegna)"
            />
          </div>
          <div>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              v-model="ttl"
            >
              <option :value="3600">1 ora</option>
              <option :value="7200">2 ore</option>
              <option :value="86400">24 ore</option>
              <option :value="604800">7 giorni</option>
              <option :value="2592000">30 giorni</option>
            </select>
          </div>
          <div>
            <button 
              class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              :disabled="creating"
              @click="create"
            >
              Genera
            </button>
          </div>
        </div>
      </div>

      <div v-if="newUrl" class="bg-blue-100 text-blue-800 px-4 py-2 rounded-md mb-6">
        <strong>URL di accesso:</strong><br />
        <input 
          class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          readonly 
          :value="newUrl"
          @focus="$event.target.select()"
        />
      </div>

      <h5 class="text-lg font-semibold mb-4">Token attivi</h5>
      <div v-if="tokens.length === 0" class="text-center text-gray-500 py-4">
        Nessun token attivo
      </div>
      <div v-else>
        <div v-for="t in tokens" :key="t.id" class="bg-white rounded-lg shadow-md p-4 mb-4">
          <div class="flex-1">
            <p class="font-medium">{{ t.label }}</p>
            <p class="text-sm text-gray-500">{{ t.created_at }}</p>
          </div>
          <div class="flex items-center space-x-3">
            <button 
              class="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              @click="copy(t.url)"
              title="Copia URL"
            >
              Copia URL
            </button>
            <button 
              class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              @click="revoke(t.id)"
              title="Revoca token"
            >
              Revoca
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const password = ref('')
const authed = ref(false)
const creating = ref(false)
const label = ref('')
const ttl = ref('86400')
const newUrl = ref('')
const tokens = ref([])

const router = useRouter()

// Le fetch admin usano tutte `credentials: include` per spedire il cookie
// di sessione, e l'header X-Requested-With come CSRF check basilare.
const ADMIN_FETCH = {
  credentials: 'include',
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
}

async function checkSession() {
  // All'apertura della pagina, vedo se il cookie e' ancora valido
  // (chiama un endpoint protetto; 200 => loggato)
  try {
    const res = await fetch('/api/admin/tokens', { ...ADMIN_FETCH, headers: { ...ADMIN_FETCH.headers } })
    if (res.ok) {
      authed.value = true
      await loadTokens()
    }
  } catch (e) { /* offline o simili: lascio il form di login */ }
}

async function login() {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ password: password.value })
    })
    if (!res.ok) {
      alert('Login fallito')
      return
    }
    authed.value = true
    password.value = ''
    await loadTokens()
  } catch (e) {
    alert('Errore di connessione')
  }
}

async function logout() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
  } catch (e) { /* ignora */ }
  authed.value = false
  tokens.value = []
}

async function loadTokens() {
  try {
    const res = await fetch('/api/admin/tokens', ADMIN_FETCH)
    if (!res.ok) {
      if (res.status === 401) authed.value = false
      alert('Impossibile caricare i token')
      return
    }
    const data = await res.json()
    tokens.value = data.tokens || []
  } catch (e) {
    alert('Errore di connessione')
  }
}

async function create() {
  if (!label.value.trim()) {
    alert('Inserisci un\'etichetta')
    return
  }
  creating.value = true
  try {
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ label: label.value, ttl_seconds: Number(ttl.value) || 86400 })
    })
    if (!res.ok) {
      alert('Errore nella creazione')
      return
    }
    const data = await res.json()
    // Costruisco l'URL dal token + host corrente
    newUrl.value = `${window.location.origin}/gate/${data.token}`
    label.value = ''
    await loadTokens()
  } catch (e) {
    alert('Errore di connessione')
  } finally {
    creating.value = false
  }
}

async function copy(url) {
  await navigator.clipboard.writeText(url)
  alert('URL copiato!')
}

async function revoke(id) {
  if (!confirm('Revoca questo token?')) return
  try {
    const res = await fetch(`/api/admin/tokens/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    if (!res.ok) {
      alert('Errore nella revoca')
      return
    }
    await loadTokens()
  } catch (e) {
    alert('Errore di connessione')
  }
}

// Al mount: prova a usare una sessione cookie gia' presente
onMounted(() => {
  checkSession()
})
</script>