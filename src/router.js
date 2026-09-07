import { createRouter, createWebHistory } from 'vue-router'
import GateControl from './views/GateControl.vue'
import AdminPanel from './views/AdminPanel.vue'

const routes = [
  { path: '/', name: 'home', redirect: '/admin' },
  { path: '/admin', name: 'admin', component: AdminPanel },
  // Catch-all per retro-compat: link /<token> redirect a /gate/<token>
  { path: '/:token', name: 'gate-legacy', redirect: to => `/gate/${to.params.token}` },
  { path: '/gate/:token', name: 'gate-control', component: GateControl }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
