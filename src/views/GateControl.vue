<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8 flex items-center justify-center">
    <div class="w-full max-w-md">

      <!-- Loading -->
      <div v-if="loading" class="text-center text-slate-300">
        <img
          src="/app-icon.jpg"
          alt="Varco Gates"
          class="w-20 h-20 mx-auto rounded-2xl shadow-lg ring-2 ring-indigo-400/30 object-cover mb-4 opacity-70"
        />
        <div class="inline-block w-10 h-10 border-2 border-slate-700 border-t-indigo-400 rounded-full animate-spin"></div>
        <p class="mt-4 text-sm">Verifica link in corso…</p>
      </div>

      <!-- Errore -->
      <div v-else-if="error" class="bg-slate-900/50 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-8 text-center shadow-2xl">
        <img
          src="/app-icon.jpg"
          alt="Varco Gates"
          class="w-16 h-16 mx-auto rounded-xl shadow-lg ring-1 ring-rose-400/30 object-cover mb-4 opacity-60"
        />
        <div class="w-12 h-12 mx-auto rounded-full bg-rose-500/20 flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <h2 class="text-lg font-medium text-white mb-1">Link non valido</h2>
        <p class="text-sm text-slate-400">{{ errorMessage }}</p>
      </div>

      <!-- Cancelli -->
      <div v-else class="space-y-4">
        <div class="text-center mb-6">
          <img
            src="/app-icon.jpg"
            alt="Varco Gates"
            class="w-24 h-24 mx-auto rounded-2xl shadow-lg ring-2 ring-indigo-400/30 object-cover mb-4"
          />
          <h1 class="text-2xl font-semibold text-white">Controllo Cancelli</h1>
          <p class="text-sm text-slate-400 mt-1">Tocca per aprire o chiudere</p>
        </div>

        <button
          v-for="g in gates"
          :key="g.id"
          :disabled="busy"
          @mousedown="vibrate()"
          @click="control(g.id, 'toggle')"
          class="w-full bg-slate-900/50 hover:bg-slate-800/70 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition shadow-xl"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-lg font-medium text-white">{{ g.label }}</p>
              <p class="text-xs text-slate-500">Apri / Chiudi</p>
            </div>
            <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </button>

        <!-- Feedback -->
        <transition name="fade">
          <div v-if="msg" class="rounded-xl p-4 text-center text-sm"
            :class="msgOk ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'">
            {{ msg }}
          </div>
        </transition>

        <p class="text-center text-xs text-slate-600 mt-6">
          Azione registrata · puoi richiudere subito
        </p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Swal from 'sweetalert2'

const route = useRoute()
const loading = ref(true)
const error = ref(false)
const errorMessage = ref('Link non valido o scaduto')
const gates = ref([])
const busy = ref(false)
const msg = ref('')
const msgOk = ref(true)
const token = route.params.token || ''

const vibrate = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(50)
  }
}

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

onMounted(async () => {
  try {
    const r = await fetch('/api/verify/' + token)
    if (!r.ok) {
      try {
        const errorData = await r.json()
        errorMessage.value = errorData.error || 'Link non valido o scaduto'
      } catch (e) {
        errorMessage.value = 'Link non valido o scaduto'
      }
      error.value = true
      return
    }
    const data = await r.json()
    gates.value = data.gates || []
  } catch (e) {
    errorMessage.value = 'Errore di rete'
    error.value = true
  } finally {
    loading.value = false
  }
})

async function control(gate, action) {
  if (busy.value) return
  busy.value = true
  msg.value = ''
  try {
    const r = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ token, gate, action })
    })
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      msg.value = data.error || 'Comando fallito'
      msgOk.value = false
      return
    }
    msg.value = 'Comando inviato'
    msgOk.value = true
    setTimeout(() => { msg.value = '' }, 2500)
  } catch (e) {
    msg.value = 'Errore di rete'
    msgOk.value = false
  } finally {
    busy.value = false
  }
}
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
.swal-dark-input {
  background: rgba(2, 6, 23, .6) !important;
  border: 1px solid rgba(71, 85, 105, .6) !important;
  color: #e2e8f0 !important;
  border-radius: .5rem !important;
}
</style>
