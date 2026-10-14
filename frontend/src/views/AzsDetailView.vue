<template>
  <div class="azs-detail">
    <router-link to="/azs" class="back">← К списку АЗС</router-link>
    <h1>⛽ {{ station?.name || 'Станция' }}</h1>

    <div v-if="loading" class="state">Загрузка...</div>
    <div v-else-if="error" class="state error">{{ error }}</div>

    <template v-else-if="station">
      <div class="card">
        <div class="head">
          <h2>Информация</h2>
          <button v-if="canWrite && !editing" class="btn" @click="startEdit">Редактировать</button>
        </div>

        <form v-if="editing" class="form" @submit.prevent="save">
          <label>Название<input v-model="draft.name" required minlength="2" /></label>
          <label>Регион<input v-model="draft.region" /></label>
          <label>Адрес<input v-model="draft.address" /></label>
          <label>Менеджер<input v-model="draft.manager" /></label>
          <label>Топливо (через запятую)<input v-model="fuelInput" /></label>
          <label
            >Статус
            <select v-model="draft.status">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <div class="actions">
            <button class="btn primary" :disabled="saving">
              {{ saving ? 'Сохранение...' : 'Сохранить' }}
            </button>
            <button type="button" class="btn" @click="editing = false">Отмена</button>
          </div>
          <p v-if="saveError" class="error">{{ saveError }}</p>
        </form>

        <dl v-else>
          <dt>Регион</dt>
          <dd>{{ station.region || '—' }}</dd>
          <dt>Адрес</dt>
          <dd>{{ station.address || '—' }}</dd>
          <dt>Менеджер</dt>
          <dd>{{ station.manager || '—' }}</dd>
          <dt>Статус</dt>
          <dd>{{ station.status || '—' }}</dd>
          <dt>Топливо</dt>
          <dd>{{ (station.fuelTypes || []).join(', ') || '—' }}</dd>
        </dl>
      </div>

      <div class="card">
        <h2>Цены</h2>
        <div v-if="!prices.length" class="empty">Цен по станции нет</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Топливо</th>
              <th>Цена, ₽/л</th>
              <th>Предыдущая</th>
              <th>Тренд</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in prices" :key="p.id">
              <td>{{ p.fuelType }}</td>
              <td>{{ p.price ?? '—' }}</td>
              <td>{{ p.previousPrice ?? '—' }}</td>
              <td>{{ p.trend || '—' }}</td>
              <td>
                {{ p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ru-RU') : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Продажи за 30 дней</h2>
        <SeriesChart v-if="salesChart.labels.length" :chart="salesChart" class="chart" />
        <div v-if="!sales.length" class="empty">Продаж по станции нет</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Топливо</th>
              <th>Объём, л</th>
              <th>Цена, ₽/л</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in sales" :key="i">
              <td>{{ r.date }}</td>
              <td>{{ r.fuel_code }}</td>
              <td>{{ fmt(r.volume) }}</td>
              <td>{{ r.price ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Трафик, последние 14 дней</h2>
        <SeriesChart v-if="trafficChart.labels.length" :chart="trafficChart" class="chart" />
        <div v-if="!traffic.length" class="empty">Данных о трафике нет</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Легковые</th>
              <th>Грузовые</th>
              <th>Скорость, км/ч</th>
              <th>Уровень обслуживания</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in traffic" :key="r.date">
              <td>{{ r.date }}</td>
              <td>{{ fmt(r.cars) }}</td>
              <td>{{ fmt(r.trucks) }}</td>
              <td>{{ fmt(r.speed) }}</td>
              <td>{{ r.service_level || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Погода, последние 14 дней</h2>
        <div v-if="!weather.length" class="empty">Данных о погоде нет</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Температура, °C</th>
              <th>Осадки, мм</th>
              <th>Ветер, м/с</th>
              <th>Состояние</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in weather" :key="r.date">
              <td>{{ r.date }}</td>
              <td>{{ r.temperature ?? '—' }}</td>
              <td>{{ r.precipitation ?? '—' }}</td>
              <td>{{ r.wind ?? '—' }}</td>
              <td>{{ r.weather_type || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Цены конкурентов (последнее наблюдение за 30 дней)</h2>
        <SeriesChart
          v-if="competitorChart && competitorChart.labels.length"
          :chart="competitorChart"
          class="chart"
        />
        <div v-if="!competitors.length" class="empty">Наблюдений конкурентов нет</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Конкурент</th>
              <th>Топливо</th>
              <th>Цена, ₽/л</th>
              <th>Наблюдено</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in competitors" :key="i">
              <td>{{ r.brand }}</td>
              <td>{{ r.fuel_code }}</td>
              <td>{{ r.price }}</td>
              <td>{{ r.observed_at }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { azsAPI } from '@/api/azs'
import { analyticsAPI } from '@/api/analytics'
import { useRequest, useMutation } from '@/composables/useRequest'
import { useAuthStore } from '@/stores/auth'
import SeriesChart from '@/components/charts/SeriesChart.vue'

const route = useRoute()
const authStore = useAuthStore()
const canWrite = computed(() => ['admin', 'manager'].includes(authStore.user?.role))

const station = ref(null)
const prices = ref([])
const sales = ref([])
const traffic = ref([])
const weather = ref([])
const competitors = ref([])
const competitorChart = ref(null)

// Карточка станции: сама станция и все её данные одним запросом-хуком
const detailState = useRequest(async (id) => {
  let st
  try {
    st = await azsAPI.getById(id)
  } catch (e) {
    if (e.response?.status === 404) {
      // ошибка с ответом, чтобы errorMessage показал её как ответ сервера, а не как обрыв сети
      const notFound = new Error('Станция не найдена')
      notFound.response = { status: 404, data: { error: 'Станция не найдена' } }
      throw notFound
    }
    throw e
  }
  const [pr, sa, tr, we, co, an] = await Promise.all([
    analyticsAPI.pricesList(),
    azsAPI.getSales(id, { days: 30 }),
    azsAPI.getTraffic(id, { days: 14 }),
    azsAPI.getWeather(id, { days: 14 }),
    azsAPI.getCompetitors(id),
    // график цен конкурентов за 120 дней по этой станции
    analyticsAPI.tab('competitors', { azsId: id }),
  ])
  return {
    station: st.data.data,
    prices: pr.data.data.filter((p) => p.azsId === id),
    sales: sa.data.data,
    traffic: tr.data.data,
    weather: we.data.data,
    competitors: co.data.data,
    competitorChart: an.data.data.sections[0]?.chart ?? null,
  }
}, null)
const loading = detailState.loading
const error = detailState.error
loading.value = true // до первой загрузки показываем состояние «загрузка»

const saveState = useMutation((id, body) => azsAPI.update(id, body).then((r) => r.data.data))

/** Серии по датам: продажи по видам топлива, трафик — легковые и грузовые */
const seriesByDate = (rows, field, key) => {
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const names = [...new Set(rows.map((r) => r[key]))]
  const map = new Map(rows.map((r) => [`${r.date}|${r[key]}`, r[field]]))
  return {
    labels: dates,
    yLabel: field === 'volume' ? 'л/день' : 'ТС/день',
    datasets: names.map((n) => ({
      label: n,
      data: dates.map((d) => map.get(`${d}|${n}`) ?? null),
    })),
  }
}
const salesChart = computed(() => seriesByDate(sales.value, 'volume', 'fuel_code'))
const trafficChart = computed(() => {
  const rows = traffic.value.flatMap((r) => [
    { date: r.date, kind: 'легковые', v: r.cars },
    { date: r.date, kind: 'грузовые', v: r.trucks },
  ])
  return seriesByDate(rows, 'v', 'kind')
})

const editing = ref(false)
const saving = saveState.loading
const saveError = saveState.error
const draft = ref({})
const fuelInput = ref('')

const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('ru-RU'))

const startEdit = () => {
  draft.value = { ...station.value }
  fuelInput.value = (station.value.fuelTypes || []).join(', ')
  saveError.value = ''
  editing.value = true
}

// Сохранение: ошибка остаётся в saveError, карточка перечитывается после успеха
const save = async () => {
  const fuelTypes = fuelInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    // сервер возвращает обновлённую станцию — показываем её сразу
    station.value = await saveState.run(station.value.id, {
      ...draft.value,
      fuelTypes,
    })
  } catch {
    return
  }
  editing.value = false
}

const applyDetail = (d) => {
  if (!d) return
  station.value = d.station
  prices.value = d.prices
  sales.value = d.sales
  traffic.value = d.traffic
  weather.value = d.weather
  competitors.value = d.competitors
  competitorChart.value = d.competitorChart
}

const loadDetail = async () => {
  applyDetail(await detailState.run(route.params.id))
}

onMounted(() => loadDetail())
</script>

<style scoped>
.azs-detail {
  max-width: 1200px;
  margin: 0 auto;
}
.back {
  color: var(--accent);
  text-decoration: none;
}
h1 {
  margin: 1rem 0 2rem;
  color: #333;
}
h2 {
  font-size: 1.1rem;
  color: #444;
  margin: 0 0 1rem;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
}
dl {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 0.5rem 1rem;
  margin: 0;
}
dt {
  color: #777;
}
dd {
  margin: 0;
  color: #222;
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
  display: flex;
  gap: 0.5rem;
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
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.state,
.empty {
  color: #666;
  padding: 1rem 0;
}
.chart {
  margin-bottom: 1rem;
}
.state.error,
.error {
  color: #c0392b;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.6rem 0.8rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}
th {
  color: #555;
  font-weight: 600;
}
@media (max-width: 768px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
