<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8">
    <div class="max-w-2xl mx-auto">

      <!-- Header -->
      <header class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/20 backdrop-blur flex items-center justify-center ring-1 ring-indigo-400/30">
            <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 11c2.21 0 4-1.79 4-4S14.21 3 12 3 8 4.79 8 7s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-semibold text-white">Varco Gates</h1>
            <p class="text-xs text-slate-400">Pannello amministratore</p>
          </div>
        </div>
        <button
          v-if="authed"
          @click="logout"
          class="px-3 py-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition"
        >Esci</button>
      </header>

      <!-- Login card -->
      <div v-if="!authed" class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl">
        <h2 class="text-lg font-medium text-white mb-1">Accesso</h2>
        <p class="text-sm text-slate-400 mb-6">Inserisci la password amministratore per continuare.</p>
        <form @submit.prevent="login" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              v-model="password"
              placeholder="••••••••••"
              autofocus
              class="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
            />
          </div>
          <button
            type="submit"
            :disabled="!password || busy"
            class="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
          >
            <svg v-if="busy" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            {{ busy ? 'Accesso…' : 'Accedi' }}
          </button>
        </form>
      </div>

      <!-- Dashboard autenticato -->
      <template v-else>
        <!-- Genera token -->
        <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 mb-6 shadow-2xl">
          <h2 class="text-lg font-medium text-white mb-1">Nuovo link di accesso</h2>
          <p class="text-sm text-slate-400 mb-5">Crea un link monouso per aprire un cancello.</p>
          <form @submit.prevent="create" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Etichetta</label>
              <input
                v-model="label"
                placeholder="es. Postino, Arianna, consegna"
                class="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Durata</label>
              <select
                v-model="ttl"
                class="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
              >
                <option :value="3600">1 ora</option>
                <option :value="86400">1 giorno</option>
                <option :value="604800">7 giorni</option>
                <option :value="2592000">30 giorni</option>
              </select>
            </div>
            <button
              type="submit"
              :disabled="!label.trim() || creating"
              class="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              <svg v-if="creating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              {{ creating ? 'Genero…' : 'Genera link' }}
            </button>
          </form>
        </div>

        <!-- URL appena generato -->
        <transition name="fade">
          <div v-if="newUrl" class="bg-indigo-500/10 border border-indigo-400/30 backdrop-blur-xl rounded-2xl p-5 mb-6">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-medium text-indigo-200">Link pronto</h3>
                <p class="text-xs text-indigo-300/70 mb-3">Copia e invialo. Dopo non sarà più visibile.</p>
                <div class="flex gap-2">
                  <input
                    readonly
                    :value="newUrl"
                    @focus="$event.target.select()"
                    class="flex-1 px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <button
                    @click="copy(newUrl)"
                    class="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                    </svg>
                    Copia
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <!-- Lista token -->
        <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-medium text-white">Link attivi</h2>
            <span class="text-xs text-slate-500">{{ activeCount }} attivi · {{ tokens.length }} totali</span>
          </div>

          <div v-if="tokens.length === 0" class="text-center py-10 text-slate-500 text-sm">
            <svg class="w-10 h-10 mx-auto mb-2 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            Nessun link creato
          </div>

          <ul v-else class="divide-y divide-slate-800">
            <li v-for="t in tokens" :key="t.id" class="py-3 flex items-center gap-3">
              <div class="w-2 h-2 rounded-full flex-shrink-0"
                :class="t.revoked ? 'bg-rose-500' : t.expired ? 'bg-amber-500' : 'bg-emerald-500'"></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-white truncate">{{ t.label || '(senza etichetta)' }}</p>
                <p class="text-xs text-slate-500">
                  <code class="font-mono">{{ t.token_prefix }}</code>
                  · {{ formatDate(t.created_at) }}
                  <span v-if="t.revoked" class="text-rose-400">· revocato</span>
                  <span v-else-if="t.expired" class="text-amber-400">· scaduto</span>
                </p>
              </div>
              <button
                v-if="!t.revoked && !t.expired"
                @click="revoke(t)"
                class="px-2.5 py-1 text-xs text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 rounded-lg transition"
                title="Revoca"
              >
                Revoca
              </button>
            </li>
          </ul>
        </div>

        <p class="text-center text-xs text-slate-600 mt-8">
          Sessione valida per 8 ore. Esci quando hai finito.
        </p>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Swal from 'sweetalert2'

const password = ref('')
const authed = ref(false)
const busy = ref(false)
const creating = ref(false)
const label = ref('')
const ttl = ref('86400')
const newUrl = ref('')
const tokens = ref([])

const ADMIN_FETCH = {
  credentials: 'include',
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
}

const activeCount = computed(() =>
  tokens.value.filter(t => !t.revoked && !t.expired).length
)

const swalDark = Swal.mixin({
  customClass: {
    popup: 'swal-dark-popup',
    title: 'swal-dark-title',
    htmlContainer: 'swal-dark-content',
    confirmButton: 'swal-dark-btn swal-dark-btn-primary',
    cancelButton: 'swal-dark-btn',
    input: 'swal-dark-input'
  },
  background: 'rgba(15, 23, 42, 0.95)',
  color: '#e2e8f0',
  buttonsStyling: false,
  reverseButtons: true
})

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}

async function checkSession() {
  try {
    const res = await fetch('/api/admin/tokens', ADMIN_FETCH)
    if (res.ok) {
      authed.value = true
      await loadTokens()
    }
  } catch (e) { /* offline */ }
}

async function login() {
  busy.value = true
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ password: password.value })
    })
    if (!res.ok) {
      await swalDark.fire({
        icon: 'error',
        title: 'Accesso negato',
        text: 'Password non corretta',
        confirmButtonText: 'Riprova'
      })
      password.value = ''
      return
    }
    authed.value = true
    password.value = ''
    await loadTokens()
  } catch (e) {
    await swalDark.fire({ icon: 'error', title: 'Errore di rete', text: 'Riprova' })
  } finally {
    busy.value = false
  }
}

async function logout() {
  const r = await swalDark.fire({
    title: 'Uscire?',
    text: 'La sessione verrà chiusa',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sì, esci',
    cancelButtonText: 'Annulla'
  })
  if (!r.isConfirmed) return
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
      return
    }
    const data = await res.json()
    tokens.value = data.tokens || []
  } catch (e) { /* offline */ }
}

async function create() {
  if (!label.value.trim()) return
  creating.value = true
  try {
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ label: label.value.trim(), ttl_seconds: Number(ttl.value) || 86400 })
    })
    if (!res.ok) {
      await swalDark.fire({ icon: 'error', title: 'Errore', text: 'Impossibile creare il link' })
      return
    }
    const data = await res.json()
    newUrl.value = `${window.location.origin}/gate/${data.token}`
    label.value = ''
    await loadTokens()
    await swalDark.fire({
      icon: 'success',
      title: 'Link creato',
      text: 'Copiabile qui sotto. Condividilo con chi deve aprire il cancello.',
      timer: 2200,
      showConfirmButton: false
    })
  } catch (e) {
    await swalDark.fire({ icon: 'error', title: 'Errore di rete' })
  } finally {
    creating.value = false
  }
}

async function copy(url) {
  try {
    await navigator.clipboard.writeText(url)
    await swalDark.fire({
      icon: 'success',
      title: 'Copiato',
      timer: 1200,
      showConfirmButton: false
    })
  } catch (e) {
    await swalDark.fire({ icon: 'error', title: 'Copia fallita', text: 'Seleziona e copia manualmente' })
  }
}

async function revoke(token) {
  const r = await swalDark.fire({
    title: 'Revocare questo link?',
    html: `<div class="text-left text-sm">
      <div class="text-slate-300">${token.label || '(senza etichetta)'}</div>
      <div class="text-xs text-slate-500 font-mono mt-1">${token.token_prefix}</div>
    </div>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sì, revoca',
    cancelButtonText: 'Annulla',
    confirmButtonClass: 'swal-dark-btn swal-dark-btn-danger'
  })
  if (!r.isConfirmed) return
  try {
    const res = await fetch(`/api/admin/tokens/${token.id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    if (!res.ok) {
      await swalDark.fire({ icon: 'error', title: 'Errore nella revoca' })
      return
    }
    await loadTokens()
    await swalDark.fire({
      icon: 'success',
      title: 'Revocato',
      timer: 1500,
      showConfirmButton: false
    })
  } catch (e) {
    await swalDark.fire({ icon: 'error', title: 'Errore di rete' })
  }
}

onMounted(() => {
  checkSession()
})
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity .25s, transform .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

.swal-dark-popup { border: 1px solid rgba(71, 85, 105, .5) !important; }
.swal-dark-title { color: #f1f5f9 !important; font-weight: 500 !important; }
.swal-dark-content { color: #cbd5e1 !important; }
.swal-dark-btn {
  padding: .5rem 1rem !important;
  border-radius: .5rem !important;
  font-weight: 500 !important;
  margin: 0 .25rem !important;
  transition: background-color .15s;
  background: rgba(51, 65, 85, .8) !important;
  color: #e2e8f0 !important;
  border: 1px solid rgba(71, 85, 105, .6) !important;
}
.swal-dark-btn:hover { background: rgba(71, 85, 105, .9) !important; }
.swal-dark-btn-primary { background: rgba(99, 102, 241, .9) !important; border-color: rgba(99, 102, 241, .5) !important; color: #fff !important; }
.swal-dark-btn-primary:hover { background: rgba(99, 102, 241, 1) !important; }
.swal-dark-btn-danger { background: rgba(244, 63, 94, .9) !important; border-color: rgba(244, 63, 94, .5) !important; color: #fff !important; }
.swal-dark-btn-danger:hover { background: rgba(244, 63, 94, 1) !important; }
.swal-dark-input {
  background: rgba(2, 6, 23, .6) !important;
  border: 1px solid rgba(71, 85, 105, .6) !important;
  color: #e2e8f0 !important;
  border-radius: .5rem !important;
}
</style>
