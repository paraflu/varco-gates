import { createRouter, createWebHistory } from 'vue-router'
import GateControl from './views/GateControl.vue'
import AdminPanel from './views/AdminPanel.vue'

const routes = [
  { path: '/', name: 'home', redirect: '/admin' },
  { path: '/admin', name: 'admin', component: AdminPanel },
  { path: '/:token', name: 'gate-control', component: GateControl }
]

export default createRouter({
  history: createWebHistory(),
  routes
})

