<template>
  <div class="series-chart">
    <Line v-if="data.labels.length" :data="data" :options="options" />
    <div v-else class="empty">Нет данных для графика</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Палитра для рядов: цвета по порядку, одинаковые для одной серии во всех графиках
const PALETTE = ['#0E7C86','#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#16a085', '#2c3e50', '#d35400', '#7f8c8d', '#f1c40f']
// Закреплённые цвета: наша цена — зелёный, ЛУКОЙЛ — красный, Газпромнефть — голубой, Роснефть — жёлтый
const SERIES_COLORS = {
  'Наша цена': '#2e9e44',
  'ЛУКОЙЛ': '#d32f2f',
  'Газпромнефть': '#4fc3f7',
  'Роснефть': '#f9c80e'
}

const props = defineProps({
  // { labels: string[], datasets: [{ label, data: (number|null)[] }], yLabel: string }
  chart: { type: Object, required: true }
})

// Цвет с прозрачностью: для участков через пропуски данных
const fade = (hex, alpha = 0.3) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Отрезок «через пропуск»: между соседними точками есть дни без данных
const isGapSegment = (ctx) => ctx.p1DataIndex - ctx.p0DataIndex > 1 || ctx.p0.parsed.y === null || ctx.p1.parsed.y === null

const data = computed(() => ({
  labels: props.chart.labels,
  datasets: props.chart.datasets.map((d, i) => {
    // фиксированный цвет по названию: наша цена и основные бренды всегда одного цвета на всех графиках
    const key = String(d.label).split(' · ')[0]
    const color = SERIES_COLORS[key] ?? PALETTE[i % PALETTE.length]
    // «Наша цена» выделяется толстой линией
    const ours = key === 'Наша цена'
    return {
      label: d.label,
      data: d.data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: ours ? 3 : 2,
      spanGaps: true,
      tension: 0.2,
      pointRadius: 2,
      segment: {
        borderColor: (ctx) => (isGapSegment(ctx) ? fade(color) : undefined),
        borderDash: (ctx) => (isGapSegment(ctx) ? [5, 4] : undefined)
      }
    }
  })
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', intersect: false },
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
  scales: {
    y: { title: { display: !!props.chart.yLabel, text: props.chart.yLabel } },
    x: { ticks: { maxTicksLimit: 12, autoSkip: true } }
  }
}))
</script>

<style scoped>
.series-chart { position: relative; height: 320px; width: 100%; }
.empty { color: #888; padding: 2rem 0; text-align: center; }
</style>
