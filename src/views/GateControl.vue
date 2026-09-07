<template>
  <div class="relative min-h-screen bg-[url('/gate-bg.jpg')] bg-cover bg-center">
    <!-- Dark overlay for text readability -->
    <div class="absolute inset-0 bg-black/40"></div>
    
    <div class="relative max-w-md mx-auto mt-12 pt-16">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-white">Controllo Cancelli</h1>
      </div>

      <template v-if="loading">
        <div class="text-center">
          <div class="flex h-12 w-12 items-center justify-center border-2 border-t-2 border-white/20 rounded-full animate-spin">
            <span class="sr-only">Attivazione...</span>
          </div>
        </div>
      </template>

      <template v-else-if="error">
        <div class="bg-red-100 text-red-800 px-4 py-2 rounded-md">
          {{ errorMessage }}
        </div>
      </template>

      <template v-else>
        <div v-for="g in gates" :key="g.id" class="bg-white/20 backdrop-blur-sm rounded-lg shadow-md p-4 mb-4">
          <div class="flex justify-center">
            <button 
              class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors duration-200 transform active:scale-95"
              :disabled="busy"
              @click="activateGate(g.id)"
              @mousedown="vibrate()"
            >
              {{ busy ? 'Attivazione...' : 'Attiva Cancello' }}
            </button>
          </div>
        </div>
        <div 
          v-if="msg" 
          :class="[
            'mt-4 px-4 py-2 rounded-md',
            msgOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          ]"
        >
          {{ msg }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const errorMessage = ref('Errore di verifica token')
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

onMounted(async () => {
  try {
    const r = await fetch('/api/verify/' + token)
    if (!r.ok) { 
      try {
        const errorData = await r.json()
        errorMessage.value = errorData.error || 'Token non valido o scaduto'
      } catch (e) {
        errorMessage.value = 'Token non valido o scaduto'
      }
      return 
    }
    const data = await r.json()
    gates.value = data.gates
  } catch (e) {
    errorMessage.value = 'Errore di connessione'
  } finally {
    loading.value = false
  }
})

async function activateGate(gateId) {
  busy.value = true
  try {
    const r = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate: gateId, action: 'open' })
    })
    if (!r.ok) {
      msg.value = await r.text()
      msgOk.value = false
      return
    }
    msg.value = 'Segnale inviato'
    msgOk.value = true
  } catch (e) {
    msg.value = 'Errore di connessione'
    msgOk.value = false
  } finally {
    busy.value = false
  }
}
</script>