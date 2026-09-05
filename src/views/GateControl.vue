<template>
  <div class="max-w-md mx-auto mt-12">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold">Controllo Cancelli</h1>
    </div>

    <template v-if="loading">
      <div class="text-center">
        <div class="flex h-12 w-12 items-center justify-center border-2 border-t-2 border-gray-200 rounded-full animate-spin">
          <span class="sr-only">Verifica token...</span>
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="bg-red-100 text-red-800 px-4 py-2 rounded-md">{{ error }}</div>
    </template>

    <template v-else>
      <div v-for="g in gates" :key="g.id" class="bg-white rounded-lg shadow-md p-4 mb-4">
        <div class="flex justify-between items-center">
          <h5 class="text-lg font-medium mb-0">{{ g.label }}</h5>
          <div class="flex items-center space-x-3">
            <span class="text-sm">{{ g.state === 'on' ? 'Aperto' : 'Chiuso' }}</span>
            <button 
              class="px-4 py-2 rounded-md font-medium transition-all duration-200"
              :class="[
                g.state === 'on' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white',
                busy && g.id === currentActionGate ? 'opacity-50' : ''
              ]"
              :disabled="busy && g.id === currentActionGate"
              @click="toggleGate(g.id)"
              @mousedown="vibrate()"
            >
              {{ g.state === 'on' ? 'Chiudi' : 'Apri' }}
            </button>
          </div>
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
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const gates = ref([])
const busy = ref(false)
const currentActionGate = ref(null)
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
    // Verify token and get gates
    const verifyRes = await fetch('/api/verify/' + token)
    if (!verifyRes.ok) { 
      error.value = await verifyRes.text(); 
      return 
    }
    const verifyData = await verifyRes.json()
    gates.value = verifyData.gates.map(gate => ({
      ...gate,
      state: 'unknown' // Will be updated below
    }))
    
    // Fetch states for each gate
    for (const gate of gates.value) {
      try {
        const stateRes = await fetch('/api/gate-state/' + gate.id)
        if (stateRes.ok) {
          const stateData = await stateRes.json()
          gate.state = stateData.state
        }
      } catch (e) {
        console.error('Failed to get state for gate', gate.id, e)
        gate.state = 'unknown'
      }
    }
  } catch (e) {
    error.value = 'Errore di connessione'
  } finally {
    loading.value = false
  }
})

async function toggleGate(gateId) {
  // Prevent multiple rapid clicks
  if (busy.value && currentActionGate.value === gateId) return
  
  busy.value = true
  currentActionGate.value = gateId
  
  try {
    // Get current gate to determine action
    const gate = gates.value.find(g => g.id === gateId)
    if (!gate) throw new Error('Gate not found')
    
    const action = gate.state === 'on' ? 'close' : 'open'
    
    const res = await fetch('/api/control/' + gateId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    
    if (!res.ok) {
      msg.value = await res.text()
      msgOk.value = false
      return
    }
    
    // Update optimistic UI
    gate.state = action === 'open' ? 'on' : 'off'
    msg.value = action === 'open' ? 'Anello aperto' : 'Anello chiuso'
    msgOk.value = true
    
    // Also update the other gate's state display if needed (though we'll refresh on next action)
    // For immediate feedback, we could fetch both states again, but let's keep it simple
    
  } catch (e) {
    msg.value = 'Errore di connessione'
    msgOk.value = false
  } finally {
    busy.value = false
    currentActionGate.value = null
    
    // Refresh state after action to ensure accuracy
    setTimeout(async () => {
      try {
        for (const gate of gates.value) {
          const stateRes = await fetch('/api/gate-state/' + gate.id)
          if (stateRes.ok) {
            const stateData = await stateRes.json()
            gate.state = stateData.state
          }
        }
      } catch (e) {
        console.error('Failed to refresh states', e)
      }
    }, 1000)
  }
}
</script>