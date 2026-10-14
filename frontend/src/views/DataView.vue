<template>
  <div class="data-view">
    <h1><SidebarIcon name="data" class="h-icon" /> Данные</h1>
    <p class="meta">
      Что загружено в систему, за какие периоды и откуда. Загрузка файлов — на странице «Импорт
      данных».
    </p>

    <div v-if="loading" class="state">Загрузка...</div>
    <div v-else-if="error" class="state error">{{ error }}</div>

    <template v-else-if="summary">
      <div class="card">
        <h2>Периоды данных</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Набор</th>
              <th>С</th>
              <th>По</th>
              <th>Строк</th>
              <th>Загружено</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in summary.periods" :key="p.dataset">
              <td>{{ p.dataset }}</td>
              <td>{{ p.from_date || '—' }}</td>
              <td>{{ p.to_date || '—' }}</td>
              <td>{{ p.rows }}</td>
              <td>
                <span :class="p.rows ? 'ok' : 'no'">{{ p.rows ? '✔' : '✘' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Источники загрузок</h2>
        <div v-if="!summary.sources.length" class="empty">
          Загрузок через интерфейс пока не было. Данные загружены пайплайном из CSV.
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Тип файла</th>
              <th>Последняя загрузка</th>
              <th>Успешно</th>
              <th>С ошибкой</th>
              <th>Записей</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in summary.sources" :key="s.import_type">
              <td>{{ typeLabel[s.import_type] || s.import_type }}</td>
              <td>{{ fmt(s.last_import) }}</td>
              <td>{{ s.ok_count }}</td>
              <td>{{ s.failed_count }}</td>
              <td>{{ s.records }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Требования к файлам</h2>
        <ul class="reqs">
          <li>
            <b>Кодировка:</b> UTF-8 (допускается BOM). Разделитель: «;» для продаж, цен конкурентов
            и магазина, «,» для трафика, погоды и акций.
          </li>
          <li><b>Даты:</b> ГГГГ-ММ-ДД. Для цен конкурентов — ДД.ММ.ГГГГ_ЧЧ:ММ:СС.</li>
          <li>
            <b>Числа:</b> десятичный разделитель — запятая или точка. Пустые значения допускаются.
          </li>
          <li>
            <b>Станция:</b> определяется по последним трём цифрам названия («АЗС 172» → 172).
            Станция должна быть в справочнике, иначе строка пропускается и попадает в отчёт.
          </li>
          <li><b>Повторная загрузка</b> того же файла обновляет строки и не создаёт дубликатов.</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import { onMounted } from 'vue'
import { useImport } from '@/composables/useImport'

const { summary, summaryLoading: loading, summaryError: error, loadSummary } = useImport()
loading.value = true // до первой загрузки показываем состояние «загрузка»

const typeLabel = {
  prices: 'Цены и продажи топлива',
  traffic: 'Трафик',
  weather: 'Погода',
  competitors: 'Цены конкурентов',
  shop: 'Продажи магазина',
  promotions: 'Акции',
}

const fmt = (d) => (d ? new Date(d).toLocaleString('ru-RU') : '—')

onMounted(() => loadSummary())
</script>

<style scoped>
.data-view {
  max-width: 1100px;
  margin: 0 auto;
}
h1 {
  margin: 0 0 0.3rem;
  color: #333;
}
h2 {
  font-size: 1.05rem;
  color: #444;
  margin: 0 0 1rem;
}
.meta {
  color: #666;
  font-size: 0.92rem;
  margin: 0 0 1.2rem;
}
.card {
  background: white;
  border-radius: 12px;
  padding: 1.3rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.2rem;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
th,
td {
  padding: 0.5rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}
th {
  color: #555;
  font-weight: 600;
  background: #f7f7fb;
}
.ok {
  color: #2f6f2f;
  font-weight: 600;
}
.no {
  color: #c0392b;
  font-weight: 600;
}
.reqs {
  margin: 0;
  padding-left: 1.2rem;
  color: #333;
  line-height: 1.7;
}
.state,
.empty {
  color: #666;
  padding: 1rem 0;
  text-align: center;
}
.state.error {
  color: #c0392b;
}
</style>
