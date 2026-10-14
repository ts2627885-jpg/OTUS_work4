<template>
  <!-- Единое сообщение о состоянии блока: загрузка, нет данных, ошибка -->
  <div class="state-message" :class="kind" role="status">
    <span class="mark" aria-hidden="true">{{ icon }}</span>
    <span class="text">{{ text || defaults[kind] }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: {
    type: String,
    default: 'empty',
    validator: (v) => ['loading', 'empty', 'error'].includes(v),
  },
  text: { type: String, default: '' },
})

const defaults = {
  loading: 'Загрузка...',
  empty: 'Данных недостаточно для расчёта',
  error: 'Не удалось загрузить данные',
}

const icon = computed(() => ({ loading: '…', empty: '○', error: '!' })[props.kind])
</script>

<style scoped>
.state-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.2rem 0.8rem;
  color: var(--muted);
  font-size: 0.95rem;
  text-align: center;
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg);
  font-weight: 600;
}

.state-message.error {
  color: var(--down);
}

.state-message.error .mark {
  background: rgba(198, 40, 40, 0.1);
}

.state-message.loading .mark {
  color: var(--accent);
}
</style>
