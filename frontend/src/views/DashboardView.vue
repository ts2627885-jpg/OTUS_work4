<template>
  <div class="dashboard">
    <div class="head">
      <div>
        <h1><SidebarIcon name="pulse" class="h-icon" /> Пульт</h1>
        <router-link to="/analytics" class="link">Аналитика по станциям и сети →</router-link>
      </div>
      <div class="controls">
        <label class="window">День анализа
          <input type="date" v-model="day" :max="maxDay" @change="load" />
        </label>
        <label class="window">Окно анализа
          <select v-model.number="days" @change="load">
            <option v-for="w in windows" :key="w" :value="w">{{ w }} дн.</option>
          </select>
        </label>
        <label class="window">Станция
          <select v-model="stationId">
            <option value="">все</option>
            <option v-for="s in stationOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
      </div>
    </div>
    <p class="meta" v-if="data">Данные на {{ data.asOfDate }}. Изменения — к предыдущим {{ data.window }} дням.</p>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">⛽</div><div class="stat-content">
        <div class="stat-label">АЗС станций</div><div class="stat-value">{{ stats.totalAZS ?? '—' }}</div></div></div>
      <div class="stat-card"><div class="stat-icon">💡</div><div class="stat-content">
        <div class="stat-label">Активные рекомендации</div><div class="stat-value">{{ stats.activeRecommendations ?? '—' }}</div></div></div>
      <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-content">
        <div class="stat-label">Пользователей</div><div class="stat-value">{{ stats.totalUsers ?? '—' }}</div></div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-content">
        <div class="stat-label">Выполнено рекомендаций</div><div class="stat-value">{{ stats.completedRecommendations ?? '—' }}</div></div></div>
    </div>

    <StateMessage v-if="loading" kind="loading" />
    <StateMessage v-else-if="error" kind="error" :text="error" />

    <template v-else-if="data">
      <div class="card">
        <h2>Срочные рекомендации</h2>
        <div v-if="!data.urgent.length" class="empty">Срочных рекомендаций нет</div>
        <ul v-else class="urgent">
          <li v-for="u in data.urgent" :key="u.id">
            <span class="badge" :class="u.priority">{{ u.priority }}</span>
            <b>{{ u.station }}</b> · {{ u.title }}: {{ u.action }}
            <span class="sub">{{ u.effect }}</span>
          </li>
        </ul>
        <router-link to="/recommendations" class="link">Все рекомендации →</router-link>
      </div>

      <div class="card rating-card">
        <h2>Рейтинг станций</h2>
        <p class="note">Сортировка по изменению объёма без акций. Полоски — относительно лучшей станции, цвет — направление. Наведите на «i» в заголовке, чтобы увидеть пояснение.</p>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>АЗС</th><th>Объём, л</th><th>Изм. объёма</th><th>Изм. без акций<HintIcon text="Без первых 14 дней после старта акции: эффект акции не смешивается с рынком." /></th><th>Акц. дней</th><th>Позиция цены, ₽<HintIcon text="Наша цена минус медиана конкурентов за 14 дней. Минус — мы дешевле." /></th>
                <th>Трафик/день<HintIcon text="Средние легковые машины в день. Станция ниже 20% медианы помечается." /></th><th>Изм. трафика</th><th>Доля заезда, л/ТС<HintIcon text="Литров топлива на одну легковую машину за те же дни." /></th><th>Изм. доли</th><th>Осадки, %<HintIcon text="Влияние дождя на объём при поправке на день недели, месяц, праздник, станцию и акции. «—» — эффект не значим." /></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in visibleStations" :key="r.id">
                <td>{{ i + 1 }}</td><td class="name">{{ r.station }}</td>
                <td class="bar-cell">
                  <span>{{ fmt(r.volume) }}</span>
                  <span class="bar"><i :style="{ width: pct(r.volume, maxVol) + '%' }"></i></span>
                </td>
                <td><span class="chip" :class="trend(r.volumeChange)">{{ arrow(r.volumeChange) }} {{ withSign(r.volumeChange) }}%</span></td>
                <td><span class="chip" :class="trend(r.volumeChangeAdj)">{{ arrow(r.volumeChangeAdj) }} {{ withSign(r.volumeChangeAdj) }}%</span></td>
                <td>{{ r.promoDays }}</td>
                <td><div class="gauge-cell"><span class="gauge-val">{{ withSign(r.pricePos, 2) }}</span><span class="gauge" :title="gaugeTitle(r.pricePos)"><i :style="{ left: gaugeX(r.pricePos) + '%' }"></i></span></div></td>
                <td class="bar-cell">
                  <span>{{ fmt(r.carsPerDay) }}</span>
                  <span class="bar"><i :style="{ width: pct(r.carsPerDay, maxCars) + '%' }"></i></span>
                </td>
                <td><span class="chip" :class="trend(r.carsChange)">{{ arrow(r.carsChange) }} {{ withSign(r.carsChange) }}%</span></td>
                <td class="bar-cell">
                  <span>{{ r.fillShare ?? '—' }}</span>
                  <span class="bar"><i :style="{ width: pct(r.fillShare, maxFill) + '%' }"></i></span>
                </td>
                <td><span class="chip" :class="trend(r.fillShareChange)">{{ arrow(r.fillShareChange) }} {{ withSign(r.fillShareChange) }}%</span></td>
                <td><span v-if="r.rainEffect === null" class="chip flat">—</span><span v-else class="chip" :class="trend(r.rainEffect)">{{ arrow(r.rainEffect) }} {{ withSign(r.rainEffect) }}%</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h2 class="cards-title">Станции</h2>
      <div class="cards">
        <router-link v-for="r in visibleStations" :key="r.id" :to="`/azs/${r.id}`" class="station-card" :class="'trend-' + trend(r.volumeChangeAdj)">
          <div class="sc-head">
            <span class="sc-name">{{ r.station }}</span>
            <span class="rank-pill" :class="'rank-' + rankOf(r)">{{ rankOf(r) <= 3 ? medal(rankOf(r)) : '№ ' + rankOf(r) }}</span>
          </div>
          <div class="sc-sub">
            <svg class="ring" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" class="ring-bg" />
              <circle cx="22" cy="22" r="18" class="ring-fg" :stroke-dasharray="ringDash(r)" />
            </svg>
            <div class="sc-sub-text">
              <div class="sc-share"><b>{{ shareOf(r) }}%</b> объёма сети · № {{ rankOf(r) }} из {{ data.stations.length }}</div>
              <span class="status" :class="trend(r.volumeChangeAdj)">{{ statusOf(r) }}</span>
              <span v-if="isLowTraffic(r)" class="warn">трафик под вопросом</span>
            </div>
          </div>

          <div class="fuels">
            <div class="frow fhead"><span>Топливо</span><span>Цена, ₽</span><span>к рынку</span></div>
            <div v-for="f in r.fuels" :key="f.fuel" class="frow">
              <span class="fname">{{ fuelName(f.fuel) }}</span>
              <b class="fprice">{{ f.price.toFixed(2) }}</b>
              <span class="fdiff" :class="diffClass(f.toMarket)">{{ f.toMarket === null ? '—' : withSign(f.toMarket, 2) }}</span>
            </div>
          </div>

          <div class="sc-block">
            <div class="sc-label"><span>Объём, л</span><b>{{ fmt(r.volume) }}</b></div>
            <div class="bar"><i :style="{ width: pct(r.volume, maxVol) + '%' }"></i></div>
          </div>

          <div class="sc-block sc-two">
            <div>
              <div class="sc-label"><span>Изм. объёма</span></div>
              <span class="chip" :class="trend(r.volumeChange)">{{ arrow(r.volumeChange) }} {{ withSign(r.volumeChange) }}%</span>
            </div>
            <div>
              <div class="sc-label"><span>Без акций</span></div>
              <span class="chip" :class="trend(r.volumeChangeAdj)">{{ arrow(r.volumeChangeAdj) }} {{ withSign(r.volumeChangeAdj) }}%</span>
            </div>
          </div>

          <div class="sc-block">
            <div class="sc-label"><span>Цена vs конкуренты, ₽</span><b>{{ withSign(r.pricePos, 2) }}</b></div>
            <span class="gauge" :title="gaugeTitle(r.pricePos)"><i :style="{ left: gaugeX(r.pricePos) + '%' }"></i></span>
            <div class="scale"><span>дешевле</span><span>дороже</span></div>
          </div>

          <div class="sc-block">
            <div class="sc-label"><span>Трафик, легк./день</span><b>{{ fmt(r.carsPerDay) }}</b></div>
            <div class="bar"><i :style="{ width: pct(r.carsPerDay, maxCars) + '%' }"></i></div>
          </div>

          <div class="sc-block">
            <div class="sc-label"><span>Доля заезда, л/ТС</span><b>{{ r.fillShare ?? '—' }}</b></div>
            <div class="bar"><i :style="{ width: pct(r.fillShare, maxFill) + '%' }"></i></div>
          </div>
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { ref, computed, onMounted } from 'vue'
import client from '@/api/client'
import StateMessage from '@/components/common/StateMessage.vue'
import HintIcon from '@/components/common/HintIcon.vue'

const windows = [7, 14, 28, 56, 91]
const days = ref(28)
const day = ref('')
const maxDay = ref('')
const stationId = ref('')
const stationOptions = ref([])
const data = ref(null)
const stats = ref({})
const loading = ref(true)
const error = ref('')

const allStations = computed(() => data.value?.stations || [])
const visibleStations = computed(() => allStations.value.filter(r => !stationId.value || r.id === stationId.value))

// максимумы по всем станциям: полоски показывают долю от лучшей станции, а не от выбранной
const maxOf = (key) => Math.max(1, ...allStations.value.map(r => Math.abs(r[key] ?? 0)))
const maxVol = computed(() => maxOf('volume'))
const maxCars = computed(() => maxOf('carsPerDay'))
const maxFill = computed(() => maxOf('fillShare'))

const pct = (v, m) => (v === null || v === undefined ? 0 : Math.max(2, Math.min(100, (Math.abs(v) / m) * 100)))
const trend = (v) => (v === null || v === undefined ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat')
const arrow = (v) => (v === null || v === undefined ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '•')
const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('ru-RU'))
const withSign = (v, d = 1) => (v === null || v === undefined ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d))
const rankOf = (r) => allStations.value.indexOf(r) + 1

// названия видов топлива как в интерфейсе сети; остальные выводятся как есть
const FUEL_NAMES = { AI92: 'АИ-92', AI95: 'АИ-95', AI100_bio: 'АИ-100 био', DT: 'ДТ', DT_bio: 'ДТ био' }
const fuelName = (code) => FUEL_NAMES[code] ?? code
// отклонение от рынка: минус — дешевле конкурентов (зелёный), плюс — дороже (розовый)
const diffClass = (v) => (v === null || v === undefined ? 'flat' : v < 0 ? 'cheap' : v > 0 ? 'dear' : 'flat')

// доля станции в объёме сети: кольцо и подпись
const sumVolume = computed(() => allStations.value.reduce((a, r) => a + (r.volume || 0), 0) || 1)
const shareOf = (r) => Math.round(((r.volume || 0) / sumVolume.value) * 100)
const RING_LEN = 2 * Math.PI * 18
const ringDash = (r) => `${(((r.volume || 0) / sumVolume.value) * RING_LEN).toFixed(1)} ${RING_LEN.toFixed(1)}`
const medal = (n) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[n])

// статус по динамике без акций: порог ±2%
const statusOf = (r) => {
  const v = r.volumeChangeAdj
  if (v === null || v === undefined) return 'нет данных'
  if (v >= 2) return 'растёт'
  if (v <= -2) return 'снижается'
  return 'стабильно'
}

// станция заметно ниже медианы по трафику: предупреждение (то же правило, что TRAFFIC-003)
const medianCars = computed(() => {
  const xs = allStations.value.map(r => r.carsPerDay || 0).sort((a, b) => a - b)
  if (!xs.length) return 0
  const m = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
})
const isLowTraffic = (r) => r.carsPerDay !== null && r.carsPerDay !== undefined && r.carsPerDay < 0.2 * medianCars.value

// шкала позиции цены: центр — паритет с конкурентами, ±2 ₽ — края
const gaugeX = (v) => (v === null || v === undefined ? 50 : 50 + Math.max(-1, Math.min(1, v / 2)) * 50)
const gaugeTitle = (v) => (v === null || v === undefined ? 'нет данных' : v < 0 ? `дешевле конкурентов на ${Math.abs(v).toFixed(2)} ₽` : `дороже конкурентов на ${v.toFixed(2)} ₽`)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { days: days.value }
    if (day.value) params.date = day.value
    const { data: res } = await client.get('/dashboard', { params })
    data.value = res.data
    if (!maxDay.value) maxDay.value = res.data.asOfDate
    if (!day.value) day.value = res.data.asOfDate
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const { data: list } = await client.get('/azs')
    stationOptions.value = list.data
  } catch {
    stationOptions.value = []
  }
  try {
    const { data: st } = await client.get('/admin/stats/overall')
    stats.value = st.data
  } catch {
    stats.value = {}
  }
  load()
})
</script>

<style scoped>
.dashboard { max-width: 1200px; margin: 0 auto; }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
h1 { margin: 0 0 0.2rem; color: #333; }
h2 { font-size: 1.05rem; color: #444; margin: 0 0 0.6rem; }
.cards-title { margin: 1.4rem 0 0.6rem; }
.meta { color: #777; font-size: 0.9rem; margin: 0 0 1.2rem; }
.note { color: #777; font-size: 0.85rem; margin: 0 0 0.8rem; }
.window { display: flex; flex-direction: column; font-size: 0.85rem; color: #555; gap: 0.2rem; }
.window select, .window input { padding: 0.4rem; border: 1px solid #ddd; border-radius: 6px; }
.controls { display: flex; gap: 0.8rem; flex-wrap: wrap; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.2rem; }
.stat-card { background: white; border-radius: 12px; padding: 1rem; display: flex; gap: 0.8rem; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.stat-icon { font-size: 1.6rem; }
.stat-label { color: #777; font-size: 0.85rem; }
.stat-value { font-size: 1.4rem; font-weight: 600; color: #333; }
.card { background: white; border-radius: 12px; padding: 1.3rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 1.2rem; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 0.5rem 0.6rem; text-align: left; border-bottom: 1px solid #eee; white-space: nowrap; vertical-align: middle; }
th { background: #f7f7fb; color: #555; font-weight: 600; }
.name { font-weight: 600; color: var(--accent); }
.urgent { margin: 0 0 0.6rem; padding-left: 1.1rem; line-height: 1.8; }
.badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.8rem; background: #eee; }
.badge.URGENT { background: #fde2e1; color: #a52a2a; }
.badge.HIGH { background: #fff0d6; color: #8a5a00; }
.badge.MEDIUM { background: #e6eefc; color: #2a4a8a; }
.sub { color: #888; font-size: 0.82rem; }
.link { color: var(--accent); text-decoration: none; font-size: 0.9rem; }
.empty, .state { color: #666; padding: 1rem 0; text-align: center; }
.state.error { color: #c0392b; }

/* плашки изменений: цвет и стрелка по направлению */
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 0.85rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.chip.up { background: #e6f4e7; color: #2e7d32; }
.chip.down { background: #fdecea; color: #c62828; }
.chip.flat { background: #eef1f4; color: #6b7785; }

/* полоска относительно лучшей станции */
.bar { display: block; height: 7px; background: #eef1f4; border-radius: 4px; overflow: hidden; margin-top: 4px; }
.bar i { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
.bar-cell { min-width: 110px; }
.bar-cell .bar { width: 100%; }

/* шкала позиции цены: зелёный слева (дешевле), красный справа (дороже), точка — наша позиция */
.gauge { position: relative; display: block; height: 8px; border-radius: 4px; background: linear-gradient(90deg, #a5d6a7, #eef1f4 50%, #ef9a9a); margin: 6px 0 2px; }
.gauge::after { content: ''; position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; background: #9aa6b2; transform: translateX(-50%); }
.gauge i { position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.25); transform: translate(-50%, -50%); }
.gauge-cell { min-width: 110px; }
.gauge-val { display: block; font-variant-numeric: tabular-nums; font-weight: 600; color: #333; }
.scale { display: flex; justify-content: space-between; font-size: 0.7rem; color: #8a96a3; }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
/* карточка станции в тёмном стиле: крупные значения, цветные изменения */
.station-card { display: block; background: #242f3d; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 10px rgba(15, 42, 68, 0.25); text-decoration: none; color: #e8edf3; }
.station-card:hover { box-shadow: 0 6px 18px rgba(15, 42, 68, 0.4); transform: translateY(-1px); }
/* полоска сверху цветом динамики */
.station-card.trend-up { box-shadow: inset 0 3px 0 #66bb6a, 0 2px 10px rgba(15, 42, 68, 0.25); }
.station-card.trend-down { box-shadow: inset 0 3px 0 #ef5350, 0 2px 10px rgba(15, 42, 68, 0.25); }
.station-card.trend-up:hover { box-shadow: inset 0 3px 0 #66bb6a, 0 6px 18px rgba(15, 42, 68, 0.4); }
.station-card.trend-down:hover { box-shadow: inset 0 3px 0 #ef5350, 0 6px 18px rgba(15, 42, 68, 0.4); }
/* медали первых мест */
.rank-pill.rank-1 { background: linear-gradient(135deg, #ffe082, #ffb300); color: #3a2a00; font-size: 0.9rem; }
.rank-pill.rank-2 { background: linear-gradient(135deg, #eceff1, #b0bec5); color: #263238; font-size: 0.9rem; }
.rank-pill.rank-3 { background: linear-gradient(135deg, #e0a97a, #a1643a); color: #2b1608; font-size: 0.9rem; }
/* кольцо доли в объёме сети */
.sc-sub { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.9rem; }
.ring { width: 46px; height: 46px; flex-shrink: 0; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: rgba(255, 255, 255, 0.12); stroke-width: 5; }
.ring-fg { fill: none; stroke: #ffd23f; stroke-width: 5; stroke-linecap: round; }
.sc-sub-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sc-share { font-size: 0.78rem; color: #9fb0c2; }
.sc-share b { color: #ffffff; font-size: 0.98rem; }
.status { align-self: flex-start; font-size: 0.74rem; font-weight: 600; padding: 1px 8px; border-radius: 999px; }
.status.up { background: rgba(102, 187, 106, 0.18); color: #7ee081; }
.status.down { background: rgba(239, 83, 80, 0.18); color: #ff8a80; }
.status.flat { background: rgba(255, 255, 255, 0.08); color: #9fb0c2; }
.warn { align-self: flex-start; font-size: 0.72rem; padding: 1px 8px; border-radius: 999px; background: rgba(255, 183, 77, 0.15); color: #ffcc80; }
.station-card .chip.up { background: rgba(102, 187, 106, 0.18); color: #7ee081; }
.station-card .chip.down { background: rgba(239, 83, 80, 0.18); color: #ff8a80; }
.station-card .chip.flat { background: rgba(255, 255, 255, 0.08); color: #9fb0c2; }
.station-card .bar { background: rgba(255, 255, 255, 0.12); }
.station-card .bar i { background: #ffd23f; }
.station-card .gauge::after { background: rgba(255, 255, 255, 0.5); }
.station-card .scale { color: #7f90a3; }
.sc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.7rem; }
.sc-name { font-weight: 700; color: #ffffff; font-size: 1.05rem; letter-spacing: 0.2px; }
.rank-pill { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); color: #cfd8e3; font-weight: 600; }
.sc-block { margin-bottom: 0.7rem; }
.sc-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.82rem; color: #9fb0c2; }
.sc-label b { color: #ffd23f; font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.sc-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.sc-two .sc-label { margin-bottom: 4px; }

@media (max-width: 768px) {
  /* на телефоне таблица рейтинга скрыта: станции выводятся карточками */
  .rating-card { display: none; }
  .cards { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .stat-card { padding: 0.7rem; }
  .stat-value { font-size: 1.15rem; }
}
/* карточки станций: бирюзовый вариант 2 (средний бирюзовый), без цветных полосок сверху */
.station-card,
.station-card.trend-up,
.station-card.trend-down { background: #135a60; color: #eefafa; box-shadow: 0 2px 10px rgba(6, 40, 44, 0.3); border-top: 0; }
.station-card:hover,
.station-card.trend-up:hover,
.station-card.trend-down:hover { box-shadow: 0 6px 18px rgba(6, 40, 44, 0.4); }
.station-card .sc-name { color: #ffffff; }
.station-card .sc-label { color: #a6d9dc; }
.station-card .sc-label b { color: #c9fff7; }
.station-card .sc-share { color: #a6d9dc; }
.station-card .sc-share b { color: #ffffff; }
.station-card .chip.up { background: rgba(185, 246, 202, 0.2); color: #c8f7d2; }
.station-card .chip.down { background: rgba(255, 160, 150, 0.22); color: #ffd0c9; }
.station-card .chip.flat { background: rgba(255, 255, 255, 0.1); color: #a6d9dc; }
.station-card .bar { background: rgba(255, 255, 255, 0.16); }
.station-card .bar i { background: #c9fff7; }
.station-card .gauge { background: rgba(255, 255, 255, 0.18); }
.station-card .gauge::after { background: rgba(255, 255, 255, 0.45); }
.station-card .gauge i { background: #ffffff; border-color: #135a60; }
.station-card .scale { color: #8fc3c7; }
.station-card .ring-bg { stroke: rgba(255, 255, 255, 0.16); }
.station-card .ring-fg { stroke: #c9fff7; }
.station-card .status.up { background: rgba(185, 246, 202, 0.2); color: #c8f7d2; }
.station-card .status.down { background: rgba(255, 160, 150, 0.22); color: #ffd0c9; }
.station-card .status.flat { background: rgba(255, 255, 255, 0.1); color: #a6d9dc; }
.station-card .warn { background: rgba(255, 255, 255, 0.14); color: #fff3c4; }

/* список видов топлива станции: только её виды */
.fuels { margin-bottom: 0.9rem; border-radius: 10px; background: rgba(255, 255, 255, 0.07); padding: 6px 10px; }
.frow { display: grid; grid-template-columns: 1fr auto 64px; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.85rem; }
.frow:last-child { border-bottom: 0; }
.frow.fhead { font-size: 0.7rem; color: #8fc3c7; text-transform: uppercase; letter-spacing: 0.3px; padding-bottom: 4px; }
.fname { color: #d8f3f4; }
.fprice { color: #c9fff7; font-size: 1rem; font-variant-numeric: tabular-nums; text-align: right; }
.fdiff { text-align: right; font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.fdiff.cheap { color: #b9f6ca; }
.fdiff.dear { color: #ffb4ac; }
.fdiff.flat { color: #8fc3c7; }
</style>
