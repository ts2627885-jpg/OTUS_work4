<template>
  <div class="analytics">
    <div class="head">
      <h1><SidebarIcon name="chart" class="h-icon" /> Аналитика</h1>
      <p class="meta" v-if="asOf">Данные по {{ asOf }}</p>
    </div>

    <div class="tabs">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="select(t.key)">
        {{ t.label }}
      </button>
    </div>

    <div class="filters" v-if="tab === 'promotions'">
      <label>Окно до и после старта
        <select v-model.number="promoWindow" @change="load">
          <option :value="7">7 дней</option>
          <option :value="14">14 дней</option>
          <option :value="28">28 дней</option>
        </select>
      </label>
    </div>

    <div class="filters" v-if="tab === 'prices'">
      <label>Окно эластичности
        <select v-model.number="windowDays" @change="load">
          <option :value="7">7 дней</option>
          <option :value="28">28 дней</option>
          <option :value="90">90 дней</option>
          <option :value="365">365 дней</option>
        </select>
      </label>
    </div>

    <div class="filters" v-if="stationTabs.includes(tab)">
      <label>АЗС
        <select v-model="azsId" @change="load">
          <option value="">все доступные</option>
          <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
    </div>

    <div class="filters" v-if="tab === 'competitors' && fuelOptions.length">
      <label>Топливо
        <select v-model="fuelFilter">
          <option value="">все</option>
          <option v-for="f in fuelOptions" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>
    </div>

    <div v-if="loading" class="state">Расчёт...</div>
    <div v-else-if="error" class="state error">{{ error }}</div>

    <template v-else>
      <div v-if="tab === 'prices' && simRows.length" class="card">
        <h2>Симулятор цены</h2>
        <p class="note">Прогноз по модели эластичности: изменение объёма ≈ эластичность × (новая цена − цена) / цена. Для пар без надёжной модели прогноз не строится.</p>
        <div class="sim">
          <label>Станция и топливо
            <select v-model="simIndex">
              <option v-for="(r, i) in simRows" :key="i" :value="i">{{ r.station }} · {{ r.fuel }} ({{ r.price }} ₽)</option>
            </select>
          </label>
          <label>Новая цена, ₽/л
            <input type="number" step="0.01" v-model.number="simPrice" />
          </label>
        </div>
        <div v-if="simResult" class="sim-result">
          <div v-if="simResult.reliable">
            Объём: <b>{{ simResult.volumeChangePct }}%</b><span v-if="simResult.bandLow !== null"> (95%: от {{ simResult.bandLow }}% до {{ simResult.bandHigh }}%)</span>
            ({{ simResult.volumeAfter }} л/день вместо {{ simResult.volumeNow }})<br />
            Выручка: <b>{{ simResult.revenueDelta }} ₽/день</b> к текущей
          </div>
          <div v-else class="empty">Эластичность для этой пары ненадёжна (R² &lt; 0.36) — прогноз не строится. Нужен A/B-тест цены.</div>
        </div>
      </div>

      <div v-for="(s, i) in visibleSections" :key="i" class="card">
        <h2>{{ s.title }}</h2>
        <p v-if="s.note" class="note">{{ s.note }}</p>
        <SeriesChart v-if="s.chart && s.chart.labels.length" :chart="s.chart" class="chart" />
        <StateMessage v-if="!s.rows.length && !(s.chart && s.chart.labels.length)" kind="empty" />
        <div v-else-if="s.rows.length" class="table-wrap">
          <table class="table">
            <thead>
              <tr><th v-for="c in s.columns" :key="c.key">{{ c.label }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, j) in s.rows" :key="j">
                <td v-for="c in s.columns" :key="c.key" :class="{ num: isNum(r[c.key]) }">{{ cell(r[c.key]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { ref, computed, onMounted } from 'vue'
import client from '@/api/client'
import { azsAPI } from '@/api/azs'
import SeriesChart from '@/components/charts/SeriesChart.vue'
import StateMessage from '@/components/common/StateMessage.vue'

const tabs = [
  { key: 'prices', label: 'Ценовая политика' },
  { key: 'competitors', label: 'Конкуренты' },
  { key: 'traffic', label: 'Трафик' },
  { key: 'factors', label: 'Факторы спроса' },
  { key: 'volume', label: 'Влияние на объём' },
  { key: 'shop', label: 'Сопутствующие товары' },
  { key: 'promotions', label: 'Акции' }
]
// вкладки, где можно выбрать одну станцию
const stationTabs = ['prices', 'competitors', 'traffic', 'volume', 'shop']

const tab = ref('prices')
const simIndex = ref(0)
const simPrice = ref(null)

/** Строки для симулятора: только пары с ценой и объёмом */
const simRows = computed(() => (sections.value[0]?.rows || []).filter(r => r.price && r.volumeMa7))
const simResult = computed(() => {
  const r = simRows.value[simIndex.value]
  if (!r || simPrice.value === null || simPrice.value === '' || !(simPrice.value > 0)) return null
  if (r.elasticity === null || r.elasticity === undefined) return { reliable: false }
  const pctPrice = (simPrice.value - r.price) / r.price
  const volumeChangePct = r.elasticity * pctPrice * 100
  const volumeAfter = r.volumeMa7 * (1 + volumeChangePct / 100)
  const revenueDelta = volumeAfter * simPrice.value - r.volumeMa7 * r.price
  // 95%-интервал: эластичность e ± 1.96·se, умноженная на то же изменение цены
  const bandLow = r.se != null ? (r.elasticity - 1.96 * r.se) * pctPrice * 100 : null
  const bandHigh = r.se != null ? (r.elasticity + 1.96 * r.se) * pctPrice * 100 : null
  return {
    reliable: true,
    bandLow: bandLow === null ? null : Math.min(bandLow, bandHigh).toFixed(1),
    bandHigh: bandHigh === null ? null : Math.max(bandLow, bandHigh).toFixed(1),
    volumeChangePct: volumeChangePct.toFixed(1),
    volumeAfter: Math.round(volumeAfter),
    volumeNow: Math.round(r.volumeMa7),
    revenueDelta: Math.round(revenueDelta).toLocaleString('ru-RU')
  }
})
const azsId = ref('')
const windowDays = ref(365)
const promoWindow = ref(14)
const stations = ref([])
const sections = ref([])
// переключатель топлива: раздел с полем fuel виден, если выбран его вид топлива (или выбрано «все»)
const fuelFilter = ref('')
const fuelOptions = computed(() => [...new Set(sections.value.map(s => s.fuel).filter(Boolean))].sort())
const visibleSections = computed(() => sections.value.filter(s => !s.fuel || !fuelFilter.value || s.fuel === fuelFilter.value))
const asOf = ref(null)
const loading = ref(true)
const error = ref('')

const cell = (v) => (v === null || v === undefined || v === '' ? '—' : v)
// числа выравниваем по правому краю, текст — по левому
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = azsId.value && stationTabs.includes(tab.value) ? { azsId: azsId.value } : {}
    if (tab.value === 'prices') params.window = windowDays.value
    if (tab.value === 'promotions') params.promoWindow = promoWindow.value
    const { data } = await client.get(`/analytics/${tab.value}`, { params })
    sections.value = data.data.sections
    asOf.value = data.data.asOf
  } catch (e) {
    error.value = e.response?.data?.error || e.message
    sections.value = []
  } finally {
    loading.value = false
  }
}

const select = (key) => {
  tab.value = key
  load()
}

onMounted(async () => {
  try {
    const { data } = await azsAPI.getAll()
    stations.value = data.data
  } catch {
    stations.value = []
  }
  load()
})
</script>

<style scoped>
.analytics { max-width: 1200px; margin: 0 auto; }
.head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
h1 { margin: 0; color: #333; }
h2 { font-size: 1.05rem; color: #444; margin: 0 0 0.4rem; }
.meta { color: #777; font-size: 0.9rem; margin: 0; }
.note { color: #777; font-size: 0.85rem; margin: 0 0 0.8rem; }
.tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
.tab { border: 1px solid #ddd; background: white; border-radius: 999px; padding: 0.4rem 0.9rem; cursor: pointer; color: #444; }
.tab.active { background: var(--accent); border-color: var(--accent); color: white; }
.filters { margin-bottom: 1rem; }
.filters label { display: flex; flex-direction: column; font-size: 0.85rem; color: #555; gap: 0.2rem; max-width: 280px; }
.filters select { padding: 0.35rem; border: 1px solid #ddd; border-radius: 6px; }
.card { background: white; border-radius: 12px; padding: 1.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 1.2rem; }
.table-wrap { overflow-x: auto; }
.chart { margin-bottom: 1rem; }
.sim { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.sim label { display: flex; flex-direction: column; font-size: 0.85rem; color: #555; gap: 0.2rem; min-width: 260px; }
.sim select, .sim input { padding: 0.4rem; border: 1px solid #ddd; border-radius: 6px; }
.sim-result { font-size: 0.95rem; line-height: 1.6; }
.table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 0.5rem 0.7rem; text-align: left; border-bottom: 1px solid #eee; white-space: nowrap; }
th { color: #555; font-weight: 600; background: #f7f7fb; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.state, .empty { color: #666; padding: 1.5rem; text-align: center; }
.state.error { color: #c0392b; }
</style>
