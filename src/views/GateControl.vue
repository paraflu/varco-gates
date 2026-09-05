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
          <div>
            <button 
              class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded me-2"
              :disabled="busy"
              @click="control(g.id, 'open')"
            >
              Apri
            </button>
            <button 
              class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded"
              :disabled="busy"
              @click="control(g.id, 'close')"
            >
              Chiudi
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
const msg = ref('')
const msgOk = ref(true)
const token = route.params.token || ''

onMounted(async () => {
  try {
    const r = await fetch('/api/verify/' + token)
    if (!r.ok) { error.value = await r.text(); return }
    const data = await r.json()
    gates.value = data.gates
  } catch (e) {
    error.value = 'Errore di connessione'
  } finally {
    loading.value = false
  }
})

async function control(gateId, action) {
  busy.value = true
  try {
    const r = await fetch('/api/control/' + gateId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    if (!r.ok) {
      msg.value = await r.text()
      msgOk.value = false
      return
    }
    msg.value = action === 'open' ? 'Anello aperto' : 'Anello chiuso'
    msgOk.value = true
  } catch (e) {
    msg.value = 'Errore di connessione'
    msgOk.value = false
  } finally {
    busy.value = false
  }
}
</script>