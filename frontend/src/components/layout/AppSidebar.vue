<template>
  <aside class="app-sidebar" :class="{ collapsed }">
    <button class="toggle" type="button" :title="collapsed ? 'Развернуть меню' : 'Свернуть меню'" @click="toggleCollapsed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-if="collapsed" d="M9 6l6 6-6 6" />
        <path v-else d="M15 6l-6 6 6 6" />
      </svg>
    </button>
    <nav class="sidebar-nav">
      <div class="nav-section">
        <router-link to="/" class="nav-item" :class="{ active: isActive('/') }" title="Пульт: станции, рекомендации, срочное">
          <span class="ico"><SidebarIcon name="pulse" /></span><span class="lbl">Пульт</span>
        </router-link>
      </div>

      <!-- Manager and above can see AZS -->
      <div v-if="canViewAzs" class="nav-section">
        <router-link to="/azs" class="nav-item" :class="{ active: isActive('/azs') }" title="Список АЗС">
          <span class="ico"><SidebarIcon name="station" /></span><span class="lbl">Станции</span>
        </router-link>
      </div>

      <!-- Analyst and above can see recommendations -->
      <div v-if="canViewRecommendations" class="nav-section">
        <router-link to="/recommendations" class="nav-item" :class="{ active: isActive('/recommendations') }" title="Рекомендации по правилам">
          <span class="ico"><SidebarIcon name="bulb" /></span><span class="lbl">Рекомендации</span>
        </router-link>
        <router-link to="/analytics" class="nav-item" :class="{ active: isActive('/analytics') }" title="Аналитика: цены, конкуренты, трафик, объём, магазин, акции">
          <span class="ico"><SidebarIcon name="chart" /></span><span class="lbl">Аналитика</span>
        </router-link>
      </div>

      <!-- Admin and managers can import data -->
      <div v-if="canImportData" class="nav-section">
        <router-link to="/import" class="nav-item" :class="{ active: isActive('/import') }" title="Импорт данных из CSV">
          <span class="ico"><SidebarIcon name="import" /></span><span class="lbl">Импорт</span>
        </router-link>
        <router-link to="/data" class="nav-item" :class="{ active: isActive('/data') }" title="Периоды и источники данных">
          <span class="ico"><SidebarIcon name="data" /></span><span class="lbl">Данные</span>
        </router-link>
      </div>

      <!-- Admin only -->
      <div v-if="authStore.isAdmin" class="nav-section">
        <router-link to="/admin" class="nav-item" :class="{ active: isActive('/admin') }" title="Администрирование: пользователи, журналы, настройки расчёта, тест цен">
          <span class="ico"><SidebarIcon name="settings" /></span><span class="lbl">Настройки</span>
        </router-link>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SidebarIcon from '@/components/layout/SidebarIcon.vue'

const route = useRoute()
const authStore = useAuthStore()

// Свёрнутое состояние запоминаем в браузере; если хранилище недоступно, просто не сохраняем
const STORAGE_KEY = 'sidebar_collapsed'
const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
const collapsed = ref(readCollapsed())
const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(STORAGE_KEY, collapsed.value ? '1' : '0')
  } catch {
    // без сохранения панель работает, просто состояние не запомнится
  }
}

const canViewAzs = computed(() =>
  authStore.hasPermission('azs_view_all') || authStore.hasPermission('azs_view_own')
)

const canViewRecommendations = computed(() =>
  authStore.hasPermission('recommendations_view')
)

const canImportData = computed(() =>
  authStore.hasPermission('data_import')
)

const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
/* Тёмная панель в тон шапке: градиент, плитки иконок, цветная полоса у активного пункта */
.app-sidebar {
  width: 150px;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--side-top) 0%, var(--side-bottom) 100%);
  overflow-y: auto;
  box-shadow: 2px 0 10px rgba(15, 42, 68, 0.15);
}

.sidebar-nav {
  padding: 0.7rem 0;
}

.nav-section {
  margin-bottom: 0.4rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nav-section:last-child {
  border-bottom: none;
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.55rem 0.25rem;
  color: var(--side-text);
  text-decoration: none;
  text-align: center;
  transition: color 0.2s ease;
}

/* плитка с иконкой */
.ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--side-tile);
  font-size: 1.15rem;
  line-height: 1;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.lbl {
  font-size: 0.7rem;
  line-height: 1.2;
}

.nav-item:hover {
  color: #ffffff;
}

.nav-item:hover .ico {
  background: rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}

/* активный пункт: цветная плитка, свечение и полоса слева */
.nav-item.active {
  color: #ffffff;
  font-weight: 600;
}

.nav-item.active .ico {
  background: var(--accent);
  box-shadow: 0 4px 14px rgba(var(--accent-rgb), 0.45);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18%;
  bottom: 18%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
}

/* кнопка сворачивания: в правом верхнем углу панели */
.toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin: 0.6rem 0 0 auto;
  margin-right: 0.6rem;
  border: none;
  border-radius: 8px;
  background: var(--side-tile);
  color: var(--side-text);
  cursor: pointer;
  transition: background 0.2s ease;
}

.toggle:hover {
  background: rgba(255, 255, 255, 0.24);
}

.toggle svg {
  width: 16px;
  height: 16px;
}

/* свёрнутая панель: только плитки с иконками */
.app-sidebar.collapsed {
  width: 64px;
}

.app-sidebar.collapsed .lbl {
  display: none;
}

.app-sidebar.collapsed .toggle {
  margin-left: auto;
  margin-right: auto;
}

.app-sidebar.collapsed .nav-item {
  padding: 0.5rem 0;
}

@media (max-width: 768px) {
  .app-sidebar {
    width: 100%;
    box-shadow: none;
  }

  .toggle {
    display: none;
  }

  .app-sidebar.collapsed {
    width: 100%;
  }

  .app-sidebar.collapsed .lbl {
    display: inline;
  }

  .sidebar-nav {
    display: flex;
    padding: 0.4rem 0.5rem;
    overflow-x: auto;
  }

  .nav-section {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0;
    padding: 0 0.4rem 0 0;
    border-bottom: none;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .nav-item {
    flex-direction: row;
    gap: 0.4rem;
    padding: 0.3rem 0.5rem;
    white-space: nowrap;
  }

  .ico {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-size: 1rem;
  }

  .nav-item.active::before {
    top: auto;
    bottom: 0;
    left: 15%;
    right: 15%;
    width: auto;
    height: 3px;
    border-radius: 3px 3px 0 0;
  }
}
</style>
