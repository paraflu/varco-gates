<template>
  <div class="container mt-5" style="max-width: 640px">
    <div class="text-center mb-4">
      <h1 class="h3">Controllo Cancelli</h1>
    </div>

    <template v-if="loading">
      <div class="text-center">
        <div class="spinner-border" role="status"><span class="visually-hidden">Verifica token...</span></div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="alert alert-danger">{{ error }}</div>
    </template>

    <template v-else>
      <div v-for="g in gates" :key="g.id" class="card mb-3">
        <div class="card-body d-flex justify-content-between align-items-center">
          <h5 class="card-title mb-0">{{ g.label }}</h5>
          <div>
            <button class="btn btn-success me-2" :disabled="busy"
              @click="control(g.id, 'open')">Apri</button>
            <button class="btn btn-danger" :disabled="busy"
              @click="control(g.id, 'close')">Chiudi</button>
          </div>
        </div>
      </div>
      <div v-if="msg" :class="'alert mt-3 ' + (msgOk ? 'alert-success' : 'alert-danger')">{{ msg }}</div>
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

async function control(gate, action) {
  busy.value = true
  msg.value = ''
  try {
    const r = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gate, action })
    })
    const data = await r.json().catch(() => ({}))
    if (r.ok) { msgOk.value = true; msg.value = 'Comando inviato' }
    else { msgOk.value = false; msg.value = data.error || 'Errore' }
  } catch (e) {
    msgOk.value = false; msg.value = 'Errore di connessione'
  } finally {
    busy.value = false
  }
}
</script>

