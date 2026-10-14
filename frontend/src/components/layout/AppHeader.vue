<template>
  <header class="app-header">
    <div class="header-content">
      <div class="logo">
        <h1><LogoMark /> АЗС-Пульт <small class="logo-ver">v2.1</small></h1>
      </div>

      <nav class="header-nav">
        <div class="user-menu">
          <span class="user-info">
            <strong>{{ authStore.user?.username }}</strong>
            <span class="user-role">{{ roleLabel }}</span>
          </span>
          <button @click="handleLogout" class="logout-btn">Выход</button>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { trackEvent } from '@/analytics'
import { EVENTS } from '@/analytics/events'
import LogoMark from '@/components/layout/LogoMark.vue'

const router = useRouter()
const authStore = useAuthStore()

const roleLabel = computed(() => {
  const role = authStore.user?.role
  const roleMap = {
    admin: 'Администратор',
    manager: 'Менеджер',
    analyst: 'Аналитик',
    viewer: 'Просмотр',
  }
  return roleMap[role] || role
})

const handleLogout = () => {
  trackEvent(EVENTS.LOGOUT)
  authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.app-header {
  background: var(--brand);
  color: white;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  max-width: 100%;
}

.logo h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-nav {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.9rem;
}

.user-role {
  font-size: 0.8rem;
  opacity: 0.9;
}

.logout-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .logo h1 {
    font-size: 1.2rem;
  }

  .user-menu {
    gap: 0.5rem;
  }
}
</style>
