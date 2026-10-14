<template>
  <div class="admin">
    <h1><SidebarIcon name="settings" class="h-icon" /> Администрация</h1>

    <div class="tabs">
      <button class="tab" :class="{ active: section === 'users' }" @click="section = 'users'">
        Пользователи
      </button>
      <button class="tab" :class="{ active: section === 'login' }" @click="openLogs('login')">
        Журнал входов
      </button>
      <button class="tab" :class="{ active: section === 'audit' }" @click="openLogs('audit')">
        Журнал аудита
      </button>
      <button class="tab" :class="{ active: section === 'settings' }" @click="openSettings">
        Настройки расчёта
      </button>
      <button class="tab" :class="{ active: section === 'pricetest' }" @click="openPriceTest">
        Тест цен
      </button>
    </div>

    <p v-if="message" class="ok">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <!-- Пользователи -->
    <template v-if="section === 'users'">
      <div class="card">
        <h2>Новый пользователь</h2>
        <form class="form" @submit.prevent="createUser">
          <label>Логин<input v-model="form.username" required minlength="3" /></label>
          <label>Почта<input v-model="form.email" type="email" required /></label>
          <label
            >Пароль<input v-model="form.password" type="password" required minlength="6"
          /></label>
          <label
            >Роль
            <select v-model="form.role">
              <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
            </select>
          </label>
          <div class="actions">
            <button class="btn primary" :disabled="busy">Создать</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>Пользователи</h2>
        <div class="filters">
          <label
            >Поиск по логину или почте<input v-model="userSearch" placeholder="начните вводить"
          /></label>
        </div>
        <div v-if="loading" class="empty">Загрузка...</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Почта</th>
              <th>Роль</th>
              <th>Активен</th>
              <th>Станции</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.id">
              <td>{{ u.username }}</td>
              <td>{{ u.email }}</td>
              <td>
                <select
                  :value="u.role"
                  :disabled="u.id === me"
                  @change="setRole(u, $event.target.value)"
                >
                  <option v-for="r in roles" :key="r" :value="r">
                    {{ r }}
                  </option>
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  :checked="u.is_active"
                  :disabled="u.id === me"
                  @change="setActive(u, $event.target.checked)"
                />
              </td>
              <td>
                <span>{{ (u.azs_ids || []).length }}</span>
                <button class="btn small" @click="openAssign(u)">Назначить</button>
              </td>
              <td>
                <button class="btn danger small" :disabled="u.id === me" @click="removeUser(u)">
                  Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="hint">
          Менеджер видит и редактирует только назначенные станции. Свою запись изменить и удалить
          нельзя.
        </p>
      </div>

      <div v-if="assigning" class="card">
        <h2>Станции для «{{ assigning.username }}»</h2>
        <p class="hint">
          Для роли «manager» доступ ограничен этими станциями. Для других ролей список не влияет на
          доступ.
        </p>
        <div class="checks">
          <label v-for="s in stations" :key="s.id" class="check">
            <input type="checkbox" :value="s.id" v-model="selected" />
            {{ s.name }}
          </label>
        </div>
        <div class="actions">
          <button class="btn primary" :disabled="busy" @click="saveAssign">Сохранить</button>
          <button class="btn" @click="assigning = null">Закрыть</button>
        </div>
      </div>
    </template>

    <!-- План теста цен: черновик, цены на станциях не меняются -->
    <template v-else-if="section === 'pricetest'">
      <div class="card">
        <h2>План контролируемого теста цен (PRICE-004)</h2>
        <p class="hint">
          Уровни цены от текущей: −1,0 … +1,0 ₽ шагом 0,5 ₽. Блоки по 2 дня, 10 блоков. Это
          <b>черновик</b>: цены на станциях этим не меняются, план нужно утвердить и применить
          вручную.
        </p>
        <div class="actions">
          <button class="btn primary" :disabled="busy" @click="createDraft">
            Создать черновик плана
          </button>
          <span v-if="planInfo" class="hint"
            >Строк: {{ planInfo.rows }}, пар: {{ planInfo.pairs }}, старт:
            {{ planInfo.startDate }}</span
          >
        </div>
      </div>

      <div class="card">
        <div class="filters">
          <label
            >Станция
            <select v-model="planStation">
              <option value="">все</option>
              <option v-for="c in planStations" :key="c" :value="c">
                {{ c }}
              </option>
            </select>
          </label>
          <label
            >Топливо
            <select v-model="planFuel">
              <option value="">все</option>
              <option v-for="f in planFuels" :key="f" :value="f">
                {{ f }}
              </option>
            </select>
          </label>
        </div>
        <div v-if="!planRows.length" class="empty">Плана пока нет. Создайте черновик.</div>
        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Станция</th>
                <th>Топливо</th>
                <th>Блок</th>
                <th>Период</th>
                <th>Текущая цена</th>
                <th>Смещение, ₽</th>
                <th>Целевая цена</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in filteredPlan" :key="i">
                <td>{{ r.station_code }}</td>
                <td>{{ r.fuel_code }}</td>
                <td>{{ r.block_no }}</td>
                <td>{{ r.start_date }} — {{ r.end_date }}</td>
                <td>{{ r.base_price }}</td>
                <td :class="r.offset_rub > 0 ? 'up' : r.offset_rub < 0 ? 'down' : ''">
                  {{ r.offset_rub > 0 ? '+' : '' }}{{ r.offset_rub }}
                </td>
                <td>
                  <b>{{ r.target_price }}</b>
                </td>
                <td>{{ r.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Настройки расчёта и config.json -->
    <template v-else-if="section === 'settings'">
      <div class="card">
        <h2>Пороги и окна правил</h2>
        <p class="hint">
          Значения по умолчанию — из AI_Agent_Rules. Изменения действуют на следующий расчёт
          рекомендаций и попадают в журнал аудита.
        </p>
        <div v-if="!settingsLoaded" class="empty">Загрузка...</div>
        <form v-else class="form" @submit.prevent="saveSettings">
          <label v-for="f in settingFields" :key="f.key">
            {{ f.label }}
            <input type="number" step="any" v-model.number="settingsForm[f.key]" />
            <span class="hint">по умолчанию: {{ settingsDefaults[f.key] }}</span>
          </label>
          <div class="actions">
            <button class="btn primary" :disabled="busy">Сохранить</button>
            <button type="button" class="btn" @click="resetSettings">
              Вернуть значения по умолчанию
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>Файл config.json</h2>
        <div class="actions">
          <button class="btn" @click="exportSettings">Скачать config.json</button>
          <label class="btn file-btn"
            >Загрузить config.json
            <input type="file" accept=".json,application/json" @change="importSettings" hidden />
          </label>
        </div>
        <p class="hint">
          Формат: {"rules": { "r2_min": 0.36, ... }}. Значения проверяются; при ошибке ничего не
          сохраняется.
        </p>
      </div>

      <div class="card">
        <h2>История изменений настроек</h2>
        <div v-if="!settingsHistory.length" class="empty">Изменений не было</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Кто</th>
              <th>Что изменено</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(h, i) in settingsHistory" :key="i">
              <td>{{ fmt(h.created_at) }}</td>
              <td>{{ h.username || '—' }}</td>
              <td class="ua">{{ describeChange(h.changes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Журналы -->
    <div v-else class="card">
      <h2>{{ section === 'login' ? 'Входы в систему' : 'Журнал аудита' }}</h2>
      <div v-if="logsLoading" class="empty">Загрузка...</div>
      <div v-else-if="!logs.length" class="empty">Записей нет</div>
      <div v-else class="table-wrap">
        <table v-if="section === 'login'" class="table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Логин</th>
              <th>Результат</th>
              <th>IP</th>
              <th>Браузер</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in logs" :key="l.id">
              <td>{{ fmt(l.created_at) }}</td>
              <td>{{ l.username }}</td>
              <td :class="l.status">
                {{ l.status === 'success' ? 'успех' : 'ошибка' }}
              </td>
              <td>{{ l.ip_address || '—' }}</td>
              <td class="ua">{{ l.user_agent || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Кто</th>
              <th>Действие</th>
              <th>Объект</th>
              <th>Изменения</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in logs" :key="a.id">
              <td>{{ fmt(a.created_at) }}</td>
              <td>{{ a.username || '—' }}</td>
              <td>{{ a.action }}</td>
              <td>{{ a.entity_type || '—' }}</td>
              <td class="ua">{{ a.changes || '—' }}</td>
              <td>{{ a.ip_address || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button class="btn" @click="openLogs(section)">Обновить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { errorMessage } from '@/composables/useRequest'
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { ref, computed, onMounted } from 'vue'
import { adminAPI } from '@/api/admin'
import { azsAPI } from '@/api/azs'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const me = computed(() => authStore.user?.id)
const roles = ['admin', 'manager', 'analyst', 'viewer']

const section = ref('users')
const users = ref([])
const userSearch = ref('')
const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  return users.value.filter(
    (u) =>
      !q ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
  )
})
const stations = ref([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const message = ref('')

const form = ref({ username: '', email: '', password: '', role: 'viewer' })
const assigning = ref(null)
const selected = ref([])

const logs = ref([])
const logsLoading = ref(false)

const settingFields = [
  { key: 'price_window_days', label: 'Окно последней цены нашей АЗС, дней' },
  { key: 'comp_window_days', label: 'Окно наблюдений конкурентов, дней' },
  { key: 'elasticity_days', label: 'Окно расчёта эластичности, дней' },
  { key: 'r2_min', label: 'Порог надёжности модели R²' },
  {
    key: 'price_gap_min',
    label: 'PRICE-001: разрыв с медианой конкурентов для срабатывания, ₽',
  },
  {
    key: 'price_gap_urgent',
    label: 'PRICE-001: разрыв для срочного приоритета, ₽',
  },
  { key: 'ab_step', label: 'PRICE-004: шаг A/B-теста, ₽' },
  {
    key: 'premium_drop_pct',
    label: 'PRICE-002: порог падения объёма за 7 дней, % (отрицательный)',
  },
  { key: 'traffic_slope_min', label: 'TRAFFIC-002: рост трафика, ТС/день' },
  {
    key: 'comp_drop_min',
    label: 'COMP-001: снижение цены конкурента, ₽ (отрицательное)',
  },
  {
    key: 'comp_reaction_min',
    label: 'COMP-001: падение объёма, доля (отрицательная)',
  },
  {
    key: 'promo_limit',
    label: 'PROMO-003: акций за 30 дней для приоритета HIGH',
  },
]
const planRows = ref([])
const planStation = ref('')
const planFuel = ref('')
const planInfo = ref(null)
const planStations = computed(() => [...new Set(planRows.value.map((r) => r.station_code))].sort())
const planFuels = computed(() => [...new Set(planRows.value.map((r) => r.fuel_code))].sort())
const filteredPlan = computed(() =>
  planRows.value.filter(
    (r) =>
      (!planStation.value || r.station_code === planStation.value) &&
      (!planFuel.value || r.fuel_code === planFuel.value)
  )
)

const loadPriceTest = async () => {
  const { data } = await adminAPI.priceTest()
  planRows.value = data.data
}

const openPriceTest = async () => {
  section.value = 'pricetest'
  error.value = ''
  try {
    await loadPriceTest()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const createDraft = () =>
  run(async () => {
    const { data } = await adminAPI.createPriceTestDraft()
    planInfo.value = data.data
    await loadPriceTest()
  }, 'Черновик плана создан (цены на станциях не изменены)')

const settingsForm = ref({})
const settingsDefaults = ref({})
const settingsHistory = ref([])
const settingsLoaded = ref(false)

const describeChange = (raw) => {
  try {
    const c = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!c?.changed?.length) return 'без изменений'
    return c.changed.map((x) => `${x.key}: ${x.from} → ${x.to}`).join('; ')
  } catch {
    return raw || '—'
  }
}

const loadSettings = async () => {
  const [st, hist] = await Promise.all([adminAPI.settings(), adminAPI.settingsHistory()])
  settingsForm.value = { ...st.data.data.values }
  settingsDefaults.value = st.data.data.defaults
  settingsHistory.value = hist.data.data
  settingsLoaded.value = true
}

const openSettings = async () => {
  section.value = 'settings'
  error.value = ''
  try {
    await loadSettings()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const saveSettings = () =>
  run(async () => {
    await adminAPI.saveSettings(settingsForm.value)
    await loadSettings()
  }, 'Настройки сохранены')

const resetSettings = () =>
  run(async () => {
    await adminAPI.saveSettings(settingsDefaults.value)
    await loadSettings()
  }, 'Возвращены значения по умолчанию')

const exportSettings = async () => {
  const { data } = await adminAPI.exportSettings()
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'config.json'
  a.click()
  URL.revokeObjectURL(url)
}

const importSettings = async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  await run(async () => {
    const parsed = JSON.parse(await file.text())
    await adminAPI.importSettings(parsed)
    await loadSettings()
  }, 'Настройки загружены из файла')
}

const fmt = (d) => (d ? new Date(d).toLocaleString('ru-RU') : '—')

const run = async (fn, okText) => {
  error.value = ''
  message.value = ''
  busy.value = true
  try {
    await fn()
    if (okText) message.value = okText
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const loadUsers = async () => {
  const { data } = await adminAPI.users()
  users.value = data.data
}

const createUser = () =>
  run(async () => {
    await adminAPI.createUser(form.value)
    form.value = { username: '', email: '', password: '', role: 'viewer' }
    await loadUsers()
  }, 'Пользователь создан')

const setRole = (u, role) =>
  run(async () => {
    await adminAPI.updateUser(u.id, { role })
    await loadUsers()
  }, 'Роль изменена')

const setActive = (u, is_active) =>
  run(async () => {
    await adminAPI.updateUser(u.id, { is_active })
    await loadUsers()
  }, 'Статус изменён')

const removeUser = (u) => {
  if (!confirm(`Удалить пользователя «${u.username}»? Это действие необратимо.`)) return
  run(async () => {
    await adminAPI.deleteUser(u.id)
    await loadUsers()
  }, 'Пользователь удалён')
}

const openAssign = async (u) => {
  assigning.value = u
  const { data } = await adminAPI.userStations(u.id)
  selected.value = data.data
}

const saveAssign = () =>
  run(async () => {
    await adminAPI.setUserStations(assigning.value.id, selected.value)
    assigning.value = null
    await loadUsers()
  }, 'Назначения сохранены')

const openLogs = async (kind) => {
  section.value = kind
  logsLoading.value = true
  try {
    const { data } = await adminAPI.logs(kind, { limit: 200 })
    logs.value = data.data
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    logsLoading.value = false
  }
}

onMounted(async () => {
  try {
    const [, st] = await Promise.all([loadUsers(), azsAPI.getAll()])
    stations.value = st.data.data
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.admin {
  max-width: 1200px;
  margin: 0 auto;
}
h1 {
  margin: 0 0 1rem;
  color: #333;
}
h2 {
  font-size: 1.05rem;
  color: #444;
  margin: 0 0 1rem;
}
.tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.tab {
  border: 1px solid #ddd;
  background: white;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}
.tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
.card {
  background: white;
  border-radius: 12px;
  padding: 1.3rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.2rem;
}
.form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
.form select,
select {
  padding: 0.45rem;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.5rem;
}
.btn {
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.9rem;
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
.btn.small {
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
  margin-left: 0.4rem;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
th,
td {
  padding: 0.5rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}
th {
  color: #555;
  font-weight: 600;
  background: #f7f7fb;
}
.ua {
  max-width: 360px;
  white-space: normal;
  color: #666;
  font-size: 0.82rem;
}
.checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.4rem 1rem;
  margin-bottom: 1rem;
}
.check {
  font-size: 0.9rem;
}
.success {
  color: #2f6f2f;
}
.failure,
.error {
  color: #c0392b;
}
.ok {
  color: #2f6f2f;
}
.hint {
  color: #888;
  font-size: 0.85rem;
  margin-top: 0.8rem;
}
.file-btn {
  display: inline-block;
}
.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
.filters label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  color: #555;
  gap: 0.2rem;
}
.up {
  color: #2f6f2f;
}
.down {
  color: #c0392b;
}
.empty {
  color: #666;
  padding: 1rem 0;
  text-align: center;
}
</style>
