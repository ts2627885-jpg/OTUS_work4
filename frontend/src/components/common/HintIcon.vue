<template>
  <!-- Короткая подсказка рядом с подписью: открывается по наведению и по нажатию, закрывается по второму нажатию или кликом мимо -->
  <span ref="root" class="hint" :class="{ open }" @click.stop="open = !open" @mouseenter="open = true" @mouseleave="open = false">
    <span class="mark" aria-hidden="true">i</span>
    <span class="bubble" role="tooltip">{{ text }}</span>
  </span>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  text: { type: String, required: true }
})

const open = ref(false)
const root = ref(null)

// клик вне подсказки закрывает её
const onDocClick = (e) => {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.hint {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  vertical-align: middle;
  cursor: help;
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--line);
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  font-style: normal;
}

.bubble {
  display: none;
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1f2933;
  color: #ffffff;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  text-align: left;
  white-space: normal;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.hint.open .bubble {
  display: block;
}
</style>
