<template>
  <div class="recommendations">
    <div class="head">
      <div>
        <h1><SidebarIcon name="bulb" class="h-icon" /> Рекомендации</h1>
        <p class="meta" v-if="analysis">
          Расчёт на {{ analysis.asOfDate }} · цена конкурента — последнее наблюдение за
          {{ analysis.windows.competitorDays }} дн., эластичность — за
          {{ analysis.windows.elasticityDays }} дн. при R² ≥
          {{ analysis.windows.r2Min }}
        </p>
      </div>
      <div v-if="canGenerate" class="head-actions">
        <button class="btn" :disabled="checking" @click="checkStations">
          {{ checking ? 'Проверка...' : 'Проверить АЗС' }}
        </button>
        <button class="btn primary" :disabled="generating" @click="generate">
          {{ generating ? 'Расчёт...' : 'Сформировать' }}
        </button>
      </div>
    </div>

    <div v-if="stationCheck" class="station-check">
      <p v-if="stationCheck.ok" class="ok">Все АЗС из аналитики есть в приложении, лишних нет.</p>
      <p v-else class="warn">
        <template v-if="stationCheck.missingInApp.length"
          >Нет в приложении: {{ stationCheck.missingInApp.join(', ') }}.
        </template>
        <template v-if="stationCheck.extraInApp.length"
          >Есть в приложении, но нет в аналитике:
          {{ stationCheck.extraInApp.join(', ') }}.</template
        >
      </p>
      <table>
        <thead>
          <tr>
            <th>Код</th>
            <th>АЗС</th>
            <th>В приложении</th>
            <th>Активных рекомендаций</th>
            <th>Строк продаж</th>
            <th>Последняя продажа</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in stationCheck.stations" :key="s.code">
            <td>{{ s.code }}</td>
            <td>{{ s.name }}</td>
            <td :class="s.inApp ? 'ok' : 'warn'">
              {{ s.inApp ? 'да' : 'нет' }}
            </td>
            <td>{{ s.inApp ? s.activeRecommendations : '—' }}</td>
            <td>{{ s.salesRows }}</td>
            <td>{{ s.lastSale || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="filters">
      <label
        >Приоритет
        <select v-model="filters.priority" @change="load">
          <option value="">все</option>
          <option v-for="p in priorities" :key="p.key" :value="p.key">
            {{ p.label }}
          </option>
        </select>
      </label>
      <label
        >Категория
        <select v-model="filters.category" @change="load">
          <option value="">все</option>
          <option v-for="c in categories" :key="c.key" :value="c.key">
            {{ c.label }}
          </option>
        </select>
      </label>
      <label
        >Статус
        <select v-model="filters.status" @change="load">
          <option value="">все</option>
          <option value="active">активные</option>
          <option value="completed">выполнено</option>
          <option value="rejected">закрыто автоматически</option>
        </select>
      </label>
    </div>

    <p v-if="actionMessage" class="ok">{{ actionMessage }}</p>
    <p v-if="actionError" class="error">{{ actionError }}</p>

    <div v-if="loading" class="state">Загрузка...</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <div v-else-if="!items.length" class="state">
      Рекомендаций нет.
      {{ canWrite ? 'Нажмите «Сформировать», чтобы рассчитать их по данным.' : '' }}
    </div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>Приоритет</th>
          <th>Правило</th>
          <th>Станция</th>
          <th>Топливо</th>
          <th>Что делать</th>
          <th>Эффект</th>
          <th>Основание</th>
          <th>Статус</th>
          <th v-if="canWrite"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in items" :key="r.id" :class="{ done: r.status !== 'active' }">
          <td>
            <span class="badge" :class="r.priority">{{ r.priority }}</span>
          </td>
          <td>
            {{ r.rule }}
            <div class="sub">{{ r.title }}</div>
          </td>
          <td>{{ r.station }}</td>
          <td>{{ r.fuel || '—' }}</td>
          <td>{{ r.action }}</td>
          <td class="effect">
            <template v-if="effectView(r.effect).kind === 'money'">
              <span class="eff-money" :class="{ 'eff-low': effectView(r.effect).low }">{{
                effectView(r.effect).text
              }}</span>
              <span class="eff-sub">{{ effectView(r.effect).sub }}</span>
            </template>
            <span
              v-else-if="effectView(r.effect).kind === 'none'"
              class="eff-none"
              :title="r.effect"
              >не рассчитан</span
            >
            <span v-else class="eff-text">{{ effectView(r.effect).text }}</span>
          </td>
          <td class="reason">{{ r.reason }}</td>
          <td>
            {{ statusLabel[r.status] || r.status }}
            <div v-if="r.completedBy" class="sub">
              {{ r.completedBy }}, {{ fmtDate(r.completedAt) }}
            </div>
          </td>
          <td v-if="canWrite">
            <button
              v-if="r.status === 'active'"
              class="btn"
              :disabled="busyId === r.id"
              @click="complete(r)"
            >
              Выполнено
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <template v-if="analysis">
      <h2>Правила, которые нельзя рассчитать на текущих данных</h2>
      <table class="table small">
        <thead>
          <tr>
            <th>Правило</th>
            <th>Причина</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in analysis.notComputed" :key="n.rule">
            <td>{{ n.rule }}</td>
            <td>{{ n.reason }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
// Эффект из правил: посчитанный (сумма в ₽/день) выделяется, нерассчитанный — тихой пометкой, остальное — текстом
const effectView = (e) => {
  const m = /^≈ ₽\s*([\d\s]+)\/день\s*\((.*)\)$/.exec(e || '')
  if (m) {
    const amount = Number(m[1].replace(/\s/g, '')).toLocaleString('ru-RU')
    return {
      kind: 'money',
      text: `${amount} ₽/день`,
      sub: m[2],
      low: m[2].startsWith('низкая'),
    }
  }
  if (/не рассчитан|не оценён|не оценено/.test(e || ''))
    return { kind: 'none', text: 'не рассчитан' }
  return { kind: 'text', text: e || '—' }
}
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { ref, computed, onMounted } from 'vue'
import { useRecommendations } from '@/composables/useRecommendations'
import { errorMessage } from '@/composables/useRequest'
import { useAuthStore } from '@/stores/auth'
import { trackEvent } from '@/analytics'
import { EVENTS } from '@/analytics/events'

const authStore = useAuthStore()
const canWrite = computed(() => ['admin', 'manager'].includes(authStore.user?.role))
// расчёт по всей сети — только администратор; менеджер отмечает выполнение по своим станциям
const canGenerate = computed(() => authStore.user?.role === 'admin')

const rec = useRecommendations()
const { items, loading, error, stationCheck, generateState, completeState } = rec
loading.value = true // до первой загрузки показываем состояние «загрузка»
const analysis = rec.rules
const generating = generateState.loading
const checking = rec.checkingStations
const busyId = ref(null)
const actionMessage = ref('')
const actionError = ref('')
const filters = ref({ priority: '', status: 'active', category: '' })
const categories = [
  { key: 'PRICE', label: 'Ценообразование' },
  { key: 'TRAFFIC', label: 'Трафик' },
  { key: 'COMP', label: 'Конкуренты' },
  { key: 'PROMO', label: 'Акции' },
  { key: 'SHOP', label: 'Товары' },
  { key: 'SYS', label: 'Системные' },
]

const priorities = [
  { key: 'URGENT', label: 'Срочно' },
  { key: 'HIGH', label: 'Высокий' },
  { key: 'MEDIUM', label: 'Средний' },
  { key: 'LOW', label: 'Низкий' },
]
const statusLabel = {
  active: 'активна',
  completed: 'выполнено',
  rejected: 'закрыто автоматически',
}

const fmtDate = (d) => (d ? new Date(d).toLocaleString('ru-RU') : '—')

const load = async () => {
  const params = {}
  if (filters.value.priority) params.priority = filters.value.priority
  if (filters.value.status) params.status = filters.value.status
  if (filters.value.category) params.category = filters.value.category
  await rec.load(params)
}

const generate = async () => {
  actionMessage.value = ''
  actionError.value = ''
  try {
    const result = await rec.generate()
    trackEvent(EVENTS.RECOMMENDATIONS_GENERATE, { saved: result.saved, closed: result.closed })
    actionMessage.value = `Сохранено рекомендаций: ${result.saved}, закрыто автоматически: ${result.closed}`
  } catch (e) {
    actionError.value = errorMessage(e)
  }
}

// Сверка АЗС из аналитики с приложением: какие станции есть, сколько рекомендаций и продаж
const checkStations = async () => {
  actionMessage.value = ''
  actionError.value = ''
  await rec.checkStations()
  if (rec.stationCheckError.value) actionError.value = rec.stationCheckError.value
}

const complete = async (r) => {
  actionMessage.value = ''
  actionError.value = ''
  busyId.value = r.id
  try {
    await rec.complete(r.id)
    trackEvent(EVENTS.RECOMMENDATION_COMPLETE, { priority: r.priority })
  } catch (e) {
    actionError.value = errorMessage(e)
  } finally {
    busyId.value = null
  }
}

onMounted(() => Promise.all([load(), rec.loadRules()]))
</script>

<style scoped>
.recommendations {
  max-width: 1200px;
  margin: 0 auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}
.head-actions {
  display: flex;
  gap: 0.5rem;
}
.station-check {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 0.8rem 1rem;
  margin-bottom: 1rem;
}
.station-check p {
  margin: 0 0 0.6rem;
}
.station-check table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.station-check th,
.station-check td {
  padding: 0.4rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}
.ok {
  color: #2e7d32;
}
.warn {
  color: #c62828;
}
h1 {
  margin: 0 0 0.3rem;
  color: #333;
}
h2 {
  font-size: 1.05rem;
  color: #444;
  margin: 2rem 0 0.8rem;
}
.meta {
  color: #777;
  font-size: 0.9rem;
  margin: 0;
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
.filters select {
  padding: 0.35rem;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.btn {
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  background: #eee;
  white-space: nowrap;
}
.btn.primary {
  background: var(--accent);
  color: white;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.85rem;
  background: #eee;
  color: #333;
}
.badge.URGENT {
  background: #fde2e1;
  color: #a52a2a;
}
.badge.HIGH {
  background: #fff0d6;
  color: #8a5a00;
}
.badge.MEDIUM {
  background: #e6eefc;
  color: #2a4a8a;
}
.badge.LOW {
  background: #eef7ee;
  color: #2f6f2f;
}
.state {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  color: #666;
  text-align: center;
}
.state.error,
.error {
  color: #c0392b;
}
.ok {
  color: #2f6f2f;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.table.small {
  font-size: 0.9rem;
}
/* колонка эффекта: посчитанный выделен, нерассчитанный — тихая пометка */
.effect {
  min-width: 160px;
}
.eff-money {
  display: inline-block;
  font-weight: 700;
  font-size: 0.95rem;
  color: #1b7f3b;
  background: #e6f4ea;
  padding: 2px 9px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}
/* низкая надёжность: жёлтая плашка вместо зелёной */
.eff-money.eff-low {
  color: #8a6100;
  background: #fff4d6;
}
.eff-sub {
  display: block;
  font-size: 0.72rem;
  color: #6b7785;
  margin-top: 3px;
}
.eff-none {
  display: inline-block;
  font-size: 0.78rem;
  color: #6b7785;
  background: #f3f5f7;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px dashed #c5ced6;
  cursor: help;
}
.eff-text {
  color: #1f2933;
}
th,
td {
  padding: 0.6rem 0.8rem;
  text-align: left;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}
th {
  background: #f7f7fb;
  color: #555;
  font-weight: 600;
}
tr.done td {
  color: #888;
}
.sub {
  color: #888;
  font-size: 0.8rem;
}
.reason {
  color: #555;
  font-size: 0.85rem;
  max-width: 320px;
}
</style>
