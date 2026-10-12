<template>
  <div id="app" class="app-container">
    <AppHeader v-if="authStore.isAuthenticated" />

    <div class="app-body">
      <AppSidebar v-if="authStore.isAuthenticated" />

      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const authStore = useAuthStore()

// Restore auth state from localStorage on app mount
onMounted(() => {
  authStore.restoreFromStorage()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}

.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

@media (max-width: 768px) {
  .app-container {
    height: auto;
    min-height: 100vh;
  }

  .app-body {
    flex-direction: column;
  }

  .main-content {
    padding: 10px;
  }
}
</style>
