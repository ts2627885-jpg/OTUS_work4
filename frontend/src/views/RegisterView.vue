<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1><LogoMark /> АЗС-Пульт <small class="logo-ver">v2.1</small></h1>
        <p>Создайте новый аккаунт</p>
      </div>

      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label for="username">Имя пользователя</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            placeholder="Минимум 3 символа"
            required
            minlength="3"
            :disabled="authStore.loading"
          />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            placeholder="Введите email"
            required
            :disabled="authStore.loading"
          />
        </div>

        <div class="form-group">
          <label for="password">Пароль</label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            placeholder="Минимум 8 символов: заглавные и строчные буквы, цифра, спецсимвол (@$!%*?&)"
            required
            minlength="8"
            :disabled="authStore.loading"
          />
        </div>

        <div class="form-group">
          <label for="passwordConfirm">Подтверждение пароля</label>
          <input
            id="passwordConfirm"
            v-model="formData.passwordConfirm"
            type="password"
            placeholder="Повторите пароль"
            required
            :disabled="authStore.loading"
          />
          <span v-if="passwordMismatch" class="error-text"> ❌ Пароли не совпадают </span>
        </div>

        <div v-if="authStore.error" class="error-message">❌ {{ authStore.error }}</div>

        <button
          type="submit"
          class="register-btn"
          :disabled="authStore.loading || passwordMismatch"
        >
          <span v-if="!authStore.loading">Зарегистрироваться</span>
          <span v-else>Регистрация...</span>
        </button>
      </form>

      <div class="register-footer">
        <p>Уже есть аккаунт? <router-link to="/login">Войти</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LogoMark from '@/components/layout/LogoMark.vue'

const router = useRouter()
const authStore = useAuthStore()

const formData = reactive({
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
})

const passwordMismatch = computed(
  () =>
    formData.password && formData.passwordConfirm && formData.password !== formData.passwordConfirm
)

const handleRegister = async () => {
  if (passwordMismatch.value) return

  try {
    await authStore.register(formData.username, formData.email, formData.password)
    router.push({ name: 'Dashboard' })
  } catch (err) {
    console.error('Registration error:', err)
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%);
  padding: 2rem;
}

.register-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 450px;
  padding: 2.5rem;
}

.register-header {
  text-align: center;
  margin-bottom: 2rem;
}

.register-header h1 {
  margin: 0 0 0.5rem 0;
  color: var(--accent);
  font-size: 1.8rem;
}

.register-header p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.error-text {
  color: #c33;
  font-size: 0.85rem;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  border-left: 3px solid #c33;
}

.register-btn {
  background: linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%);
  color: white;
  padding: 0.85rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 0.5rem;
}

.register-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(var(--accent-rgb), 0.4);
}

.register-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.register-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
}

.register-footer a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}

.register-footer a:hover {
  text-decoration: underline;
}
</style>
