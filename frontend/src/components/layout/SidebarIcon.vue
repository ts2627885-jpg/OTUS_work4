<template>
  <!-- Иконки бокового меню: тонкая линия с лёгкой заливкой акцентов, цвет из currentColor -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="s-icon"
  >
    <!-- Пульт: линия пульса на фоне круга -->
    <template v-if="name === 'pulse'">
      <circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.15" stroke="none" />
      <path d="M3 12h4l2.2-5 3.6 10 2.4-5H21" />
    </template>

    <!-- Станции: топливная колонка -->
    <template v-else-if="name === 'station'">
      <rect x="4" y="4" width="10" height="17" rx="2" fill="currentColor" fill-opacity="0.15" />
      <path d="M4 21h10" />
      <rect x="7" y="7" width="4" height="4" rx="0.6" />
      <path d="M14 9h1.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V9.5L18 7" />
    </template>

    <!-- Рекомендации: лампочка с искрой -->
    <template v-else-if="name === 'bulb'">
      <path
        d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"
        fill="currentColor"
        fill-opacity="0.15"
      />
      <path d="M9.5 19.5h5M10.5 22h3" />
      <path d="M19.5 4.5l.8-1.6M21.5 7h1.7" />
    </template>

    <!-- Аналитика: график с трендом -->
    <template v-else-if="name === 'chart'">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill="currentColor"
        fill-opacity="0.15"
        stroke="none"
      />
      <path d="M5 17l4.5-5 3.5 3.2L19 8" />
      <path d="M14.5 8H19v4.5" />
    </template>

    <!-- Импорт: стрелка в лоток -->
    <template v-else-if="name === 'import'">
      <path d="M12 3v11" />
      <path d="M8 10.5l4 4 4-4" />
      <path
        d="M4 14v4.5a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5V14"
        fill="currentColor"
        fill-opacity="0.15"
      />
    </template>

    <!-- Данные: база (стек) -->
    <template v-else-if="name === 'data'">
      <ellipse cx="12" cy="6" rx="8" ry="3" fill="currentColor" fill-opacity="0.15" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </template>

    <!-- Настройки: ползунки -->
    <template v-else-if="name === 'settings'">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" fill="currentColor" fill-opacity="0.25" />
      <circle cx="9" cy="17" r="2.2" fill="currentColor" fill-opacity="0.25" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: { type: String, required: true },
})
</script>

<style scoped>
.s-icon {
  width: 22px;
  height: 22px;
  display: inline-block;
  vertical-align: -0.2em;
}
</style>
