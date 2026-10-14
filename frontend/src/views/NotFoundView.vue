<template>
  <div class="not-found">
    <div class="not-found-content">
      <h1>404</h1>
      <h2>Страница не найдена</h2>
      <p>К сожалению, запрашиваемая страница не существует.</p>
      <router-link to="/" class="back-link">← Вернуться на главную</router-link>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.not-found-content {
  text-align: center;
}

h1 {
  font-size: 4rem;
  color: var(--accent);
  margin: 0;
}

h2 {
  font-size: 2rem;
  color: #333;
  margin: 0.5rem 0;
}

p {
  color: #666;
  margin: 1rem 0 2rem 0;
}

.back-link {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.3s ease;
  font-weight: 500;
}

.back-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(var(--accent-rgb), 0.4);
}
</style>
