<template>
  <div class="max-w-xl mx-auto mt-12">
    <h1 class="text-2xl font-bold mb-6">Admin - Token Cancelli</h1>

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
        <div v-for="t in tokens" :key="t.id" class="bg-white rounded-lg shadow-md p-4 mb-4 flex justify-between items-start">
          <div>
            <p class="font-medium">{{ t.label }}</p>
            <p class="text-sm text-gray-500">{{ t.created_at }}</p>
          </div>
          <div class="flex items-center space-x-2">
            <button 
              class="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              @click="copy(t.url)"
            >
              Copia
            </button>
            <button 
              class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              @click="revoke(t.id)"
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const password = ref('')
const authed = ref(false)
const creating = ref(false)
const label = ref('')
const ttl = ref('86400')
const newUrl = ref('')
const tokens = ref([])

const router = useRouter()

async function login() {
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    if (!res.ok) {
      alert('Login fallito')
      return
    }
    authed.value = true
    await loadTokens()
  } catch (e) {
    alert('Errore di connessione')
  }
}

async function loadTokens() {
  try {
    const res = await fetch('/admin/tokens')
    if (!res.ok) {
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
    const res = await fetch('/admin/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.value, ttl: ttl.value })
    })
    if (!res.ok) {
      alert('Errore nella creazione')
      return
    }
    const data = await res.json()
    newUrl.value = data.url
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
    const res = await fetch(`/admin/token/${id}`, {
      method: 'DELETE'
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

// Load tokens on mount if already authed (e.g., page refresh)
onMounted(() => {
  // Check if we have a token in localStorage or something? For now, assume not authed on refresh.
  // In a real app, you'd check session.
})
</script>