<template>
  <div class="data-import">
    <h1><SidebarIcon name="import" class="h-icon" /> Импорт данных</h1>
    <p class="meta">
      Загрузите один или несколько CSV: тип файла определяется по заголовкам. Данные записываются в базу, повторная загрузка
      обновляет строки и не создаёт дубликатов.
    </p>
    <p class="meta">Поддерживаются: цены и продажи топлива, трафик, погода, цены конкурентов, продажи магазина, акции.</p>

    <div class="card">
      <form @submit.prevent="upload" class="upload">
        <input type="file" accept=".csv,text/csv" multiple @change="onPick" />
        <button class="btn primary" :disabled="!files.length || busy">
          {{ busy ? 'Загрузка...' : `Загрузить${files.length ? ` (${files.length})` : ''}` }}
        </button>
      </form>
      <ul v-if="files.length" class="picked">
        <li v-for="f in files" :key="f.name">{{ f.name }} <span class="sub">{{ Math.round(f.size / 1024) }} КБ</span></li>
      </ul>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-if="result" class="card">
      <h2>Результат: файлов {{ result.files.length }}, успешно {{ okCount }}</h2>
      <table class="table">
        <thead><tr><th>Файл</th><th>Тип</th><th>Строк в файле</th><th>Записано</th><th>Пропущено</th><th>Статус</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in result.files" :key="i">
            <td>{{ r.fileName }}</td>
            <td>{{ r.ok ? (typeLabel[r.data.type] || r.data.type) : '—' }}</td>
            <td>{{ r.ok ? r.data.rows : '—' }}</td>
            <td>{{ r.ok ? r.data.written : '—' }}</td>
            <td>{{ r.ok ? r.data.skipped : '—' }}</td>
            <td :class="r.ok ? 'completed' : 'failed'">
              {{ r.ok ? 'записано' : 'ошибка' }}<span v-if="!r.ok" class="sub"> — {{ r.error }}</span>
              <span v-if="r.ok && r.data.unknownStations.length" class="sub"> · неизвестные станции: {{ r.data.unknownStations.join(', ') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="meta recalc" v-if="result.publicSync && !result.publicSync.error">
        В приложении АЗС: {{ result.publicSync.total }}<template v-if="result.publicSync.added.length">, новые: {{ result.publicSync.added.join(', ') }}</template><template v-if="result.publicSync.removed.length">, удалены: {{ result.publicSync.removed.join(', ') }}</template>.
      </p>
      <p class="meta recalc" v-else-if="result.publicSync">Синхронизация приложения не выполнена: {{ result.publicSync.error }}</p>
      <p class="meta recalc">
        <template v-if="result.recommendations && result.recommendations.error">Пересчёт рекомендаций не выполнен: {{ result.recommendations.error }}</template>
        <template v-else-if="result.recommendations">Рекомендации пересчитаны: сохранено {{ result.recommendations.saved }}, закрыто {{ result.recommendations.closed }}.</template>
        <template v-else>Рекомендации не пересчитывались: ни один файл не загружен.</template>
      </p>
    </div>

    <div class="card">
      <h2>История загрузок</h2>
      <div v-if="!history.length" class="empty">Загрузок пока не было</div>
      <table v-else class="table">
        <thead><tr><th>Дата</th><th>Файл</th><th>Тип</th><th>Записей</th><th>Статус</th><th>Кто</th></tr></thead>
        <tbody>
          <tr v-for="h in history" :key="h.id">
            <td>{{ new Date(h.imported_at).toLocaleString('ru-RU') }}</td>
            <td>{{ h.file_name }}</td>
            <td>{{ typeLabel[h.import_type] || h.import_type }}</td>
            <td>{{ h.record_count }}</td>
            <td :class="h.status">{{ h.status }}<span v-if="h.error_message" class="sub"> — {{ h.error_message }}</span></td>
            <td>{{ h.imported_by || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { ref, computed, onMounted } from 'vue'
import client from '@/api/client'

const files = ref([])
const busy = ref(false)
const error = ref('')
const result = ref(null)
const history = ref([])

const okCount = computed(() => (result.value?.files || []).filter(r => r.ok).length)

const typeLabel = {
  stations: 'Справочник АЗС',
  prices: 'Цены и продажи топлива',
  traffic: 'Трафик',
  weather: 'Погода',
  competitors: 'Цены конкурентов',
  shop: 'Продажи магазина',
  promotions: 'Акции'
}

const onPick = (e) => {
  files.value = Array.from(e.target.files || [])
  error.value = ''
  result.value = null
}

const loadHistory = async () => {
  const { data } = await client.get('/import/history')
  history.value = data.data
}

const upload = async () => {
  busy.value = true
  error.value = ''
  try {
    const fd = new FormData()
    for (const f of files.value) fd.append('file', f)
    const { data } = await client.post('/import/csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    result.value = data.data
    files.value = []
    await loadHistory()
  } catch (e) {
    error.value = e.response?.data?.error || e.message
    await loadHistory().catch(() => {})
  } finally {
    busy.value = false
  }
}

onMounted(() => loadHistory().catch(() => {}))
</script>

<style scoped>
.data-import { max-width: 1100px; margin: 0 auto; }
h1 { margin-bottom: 0.5rem; color: #333; }
h2 { font-size: 1.05rem; color: #444; margin: 0 0 1rem; }
.meta { color: #666; font-size: 0.92rem; margin: 0.2rem 0; }
.recalc { margin: 1rem 0 0; }
.card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 1.2rem 0; }
.upload { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.picked { margin: 0.8rem 0 0; padding-left: 1.2rem; color: #333; line-height: 1.6; }
.btn { border: none; border-radius: 6px; padding: 0.5rem 1rem; cursor: pointer; background: #eee; }
.btn.primary { background: var(--accent); color: white; }
.btn:disabled { opacity: 0.6; cursor: default; }
.table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.5rem 0.7rem; text-align: left; border-bottom: 1px solid #eee; }
th { color: #555; font-weight: 600; }
.completed { color: #2f6f2f; }
.failed { color: #c0392b; }
.sub { color: #888; font-size: 0.85rem; }
.empty { color: #666; padding: 1rem 0; }
.error { color: #c0392b; margin-top: 0.8rem; }
</style>
