<template>
  <div class="azs-list">
    <div class="head">
      <h1><SidebarIcon name="station" class="h-icon" /> Список АЗС</h1>
      <button v-if="canWrite" class="btn primary" @click="showForm = !showForm">
        {{ showForm ? 'Отмена' : '+ Добавить станцию' }}
      </button>
    </div>

    <form v-if="showForm" class="card form" @submit.prevent="create">
      <label>Название<input v-model="form.name" required minlength="2" /></label>
      <label>Регион<input v-model="form.region" /></label>
      <label>Адрес<input v-model="form.address" /></label>
      <label>Менеджер<input v-model="form.manager" /></label>
      <label
        >Топливо (через запятую)<input v-model="fuelInput" placeholder="AI92, AI95, DT"
      /></label>
      <label
        >Статус
        <select v-model="form.status">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </label>
      <div class="actions">
        <button class="btn primary" :disabled="saving">
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>
      <p v-if="formError" class="error">{{ formError }}</p>
    </form>

    <div v-if="stations.length" class="filters">
      <label>Поиск<input v-model="search" placeholder="название, менеджер, адрес" /></label>
      <label
        >Регион
        <select v-model="regionFilter">
          <option value="">все</option>
          <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label
        >Топливо
        <select v-model="fuelFilter">
          <option value="">любое</option>
          <option v-for="f in fuels" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>
      <label
        >Статус
        <select v-model="statusFilter">
          <option value="">все</option>
          <option v-for="st in statuses" :key="st" :value="st">{{ st }}</option>
        </select>
      </label>
      <label
        >Сортировка
        <select v-model="sortKey">
          <option value="name">по названию</option>
          <option value="region">по региону</option>
          <option value="status">по статусу</option>
        </select>
      </label>
      <span class="count">Найдено: {{ visibleStations.length }} из {{ stations.length }}</span>
    </div>

    <div v-if="loading" class="state">Загрузка...</div>
    <div v-else-if="error" class="state error">Не удалось загрузить станции: {{ error }}</div>
    <div v-else-if="!stations.length" class="state">Станций пока нет</div>
    <div v-else-if="!visibleStations.length" class="state">По этим условиям станций нет</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>Название</th>
          <th>Регион</th>
          <th>Топливо</th>
          <th>Менеджер</th>
          <th>Статус</th>
          <th v-if="isAdmin"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in visibleStations" :key="s.id" @click="openStation(s.id)">
          <td class="name">{{ s.name }}</td>
          <td>{{ s.region || '—' }}</td>
          <td>{{ (s.fuelTypes || []).join(', ') || '—' }}</td>
          <td>{{ s.manager || '—' }}</td>
          <td>{{ s.status || '—' }}</td>
          <td v-if="isAdmin" @click.stop>
            <button class="btn danger" @click="remove(s)">Удалить</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="actionError" class="error">{{ actionError }}</p>
  </div>
</template>

<script setup>
import { errorMessage } from '@/composables/useRequest'
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStations } from '@/composables/useStations'
import { trackEvent } from '@/analytics'
import { EVENTS } from '@/analytics/events'

const router = useRouter()
const authStore = useAuthStore()
const role = computed(() => authStore.user?.role)
const isAdmin = computed(() => role.value === 'admin')
const canWrite = computed(() => ['admin', 'manager'].includes(role.value))

const {
  stations,
  loading,
  error,
  load,
  create: createStation,
  remove: removeStation,
  createState,
} = useStations()
loading.value = true // до первой загрузки показываем состояние «загрузка»
const search = ref('')
const regionFilter = ref('')
const fuelFilter = ref('')
const statusFilter = ref('')
const sortKey = ref('name')

const regions = computed(() =>
  [...new Set(stations.value.map((s) => s.region).filter(Boolean))].sort()
)
const fuels = computed(() => [...new Set(stations.value.flatMap((s) => s.fuelTypes || []))].sort())
const statuses = computed(() =>
  [...new Set(stations.value.map((s) => s.status).filter(Boolean))].sort()
)

/** Фильтры и сортировка — на клиенте: список станций короткий */
const visibleStations = computed(() => {
  const q = search.value.trim().toLowerCase()
  return stations.value
    .filter(
      (s) => !q || [s.name, s.manager, s.address].some((v) => (v || '').toLowerCase().includes(q))
    )
    .filter((s) => !regionFilter.value || s.region === regionFilter.value)
    .filter((s) => !fuelFilter.value || (s.fuelTypes || []).includes(fuelFilter.value))
    .filter((s) => !statusFilter.value || s.status === statusFilter.value)
    .slice()
    .sort((a, b) =>
      String(a[sortKey.value] || '').localeCompare(String(b[sortKey.value] || ''), 'ru')
    )
})
const actionError = ref('')
const showForm = ref(false)
const saving = createState.loading
const formError = createState.error
const fuelInput = ref('')
const form = ref({
  name: '',
  region: 'Tver region',
  address: '',
  manager: '',
  status: 'active',
})

const openStation = (id) => router.push({ name: 'AzsDetail', params: { id } })

const create = async () => {
  const fuelTypes = fuelInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    await createStation({ ...form.value, fuelTypes })
  } catch {
    return // текст ошибки уже в formError
  }
  trackEvent(EVENTS.STATION_CREATE)
  form.value = {
    name: '',
    region: 'Tver region',
    address: '',
    manager: '',
    status: 'active',
  }
  fuelInput.value = ''
  showForm.value = false
}

const remove = async (s) => {
  actionError.value = ''
  if (!confirm(`Удалить станцию «${s.name}»?`)) return
  try {
    await removeStation(s.id)
  } catch (e) {
    actionError.value = errorMessage(e)
  }
}

onMounted(() => load())
</script>

<style scoped>
.azs-list {
  max-width: 1200px;
  margin: 0 auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
h1 {
  color: #333;
  margin: 0;
}
.card {
  background: white;
  border-radius: 12px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
}
.form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.8rem;
}
.form label {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  color: #555;
  gap: 0.3rem;
}
.form input,
.form select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.actions {
  grid-column: 1 / -1;
}
.btn {
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  background: #eee;
}
.btn.primary {
  background: var(--accent);
  color: white;
}
.btn.danger {
  background: #fde2e1;
  color: #a52a2a;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.state {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  color: #666;
  text-align: center;
}
.filters {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 1rem;
}
.filters label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  color: #555;
  gap: 0.2rem;
}
.filters input,
.filters select {
  padding: 0.4rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  min-width: 150px;
}
.count {
  color: #666;
  font-size: 0.9rem;
  padding-bottom: 0.4rem;
}
.state.error,
.error {
  color: #c0392b;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
th,
td {
  padding: 0.8rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}
th {
  background: #f7f7fb;
  color: #555;
  font-weight: 600;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: #f5f6ff;
}
.name {
  font-weight: 600;
  color: var(--accent);
}
@media (max-width: 768px) {
  th,
  td {
    padding: 0.6rem;
    font-size: 0.9rem;
  }
}
</style>
