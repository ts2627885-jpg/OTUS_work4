<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1><LogoMark /> АЗС-Пульт <small class="logo-ver">v2.1</small></h1>
        <p>Управление ценовой политикой для сетей АЗС</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Имя пользователя</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            placeholder="Введите имя пользователя"
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
            placeholder="Введите пароль"
            required
            :disabled="authStore.loading"
          />
        </div>

        <div v-if="authStore.error" class="error-message">❌ {{ authStore.error }}</div>

        <button type="submit" class="login-btn" :disabled="authStore.loading">
          <span v-if="!authStore.loading">Войти</span>
          <span v-else>Вход в систему...</span>
        </button>
      </form>

      <div v-if="oauthError" class="error-message oauth-error">❌ {{ oauthError }}</div>

      <div v-if="oauthProviders.length" class="oauth-block">
        <div class="oauth-divider"><span>или войдите через сервис</span></div>
        <a
          v-for="provider in oauthProviders"
          :key="provider.id"
          :href="`/api/auth/oauth/${provider.id}/start`"
          class="oauth-btn"
        >
          Войти через {{ provider.name }}
        </a>
      </div>

      <div class="login-footer">
        <p>
          Нет аккаунта?
          <router-link to="/register">Зарегистрироваться</router-link>
        </p>
        <template v-if="showDemoHint">
          <hr />
          <p class="demo-info">
            💡 Демо учетные данные:<br />
            Логин: <code>admin</code><br />
            Пароль: <code>Admin123456</code>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authAPI } from '@/api/auth'
import LogoMark from '@/components/layout/LogoMark.vue'

const router = useRouter()
const authStore = useAuthStore()

// Демо-учётка показывается только в mock-режиме (npm run dev:mock), не в боевой сборке
const showDemoHint = import.meta.env.VITE_USE_MOCKS === 'true'

const formData = reactive({
  username: '',
  password: '',
})

// Вход через провайдеров OAuth2: список приходит с сервера (пусто, если учётные данные не заданы)
const oauthProviders = ref([])
const oauthError = ref('')

const OAUTH_ERRORS = {
  access_denied: 'Вход отменён в сервисе провайдера.',
  email_taken: 'Почта уже используется учётной записью. Войдите по логину и паролю.',
  email_not_verified: 'Провайдер не подтвердил почту. Вход через него недоступен.',
  account_disabled: 'Учётная запись отключена администратором.',
  state_mismatch: 'Сессия входа устарела. Попробуйте ещё раз.',
  provider_disabled: 'Этот способ входа сейчас не настроен.',
  token_exchange_failed: 'Не удалось подтвердить вход у провайдера. Попробуйте ещё раз.',
  profile_failed: 'Не удалось получить профиль у провайдера.',
}

onMounted(async () => {
  // Результат возврата от провайдера приходит во фрагменте адреса (#oauth_token / #oauth_error).
  // Фрагмент сразу стираем из адресной строки, чтобы токен не остался в истории браузера.
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (window.location.hash) history.replaceState(null, '', window.location.pathname)

  const errorCode = params.get('oauth_error')
  if (errorCode)
    oauthError.value = OAUTH_ERRORS[errorCode] || 'Внутренняя ошибка при входе через провайдера.'

  const oauthToken = params.get('oauth_token')
  if (oauthToken) {
    try {
      await authStore.loginWithToken(oauthToken)
      router.push({ name: 'Dashboard' })
      return
    } catch {
      oauthError.value = authStore.error || 'Не удалось войти через провайдера.'
    }
  }

  try {
    const { data } = await authAPI.getOAuthProviders()
    oauthProviders.value = data?.data?.providers || []
  } catch {
    // Сервер без OAuth или mock-режим: кнопок нет, вход по паролю работает как прежде
    oauthProviders.value = []
  }
})

const handleLogin = async () => {
  try {
    await authStore.login(formData.username, formData.password)
    router.push({ name: 'Dashboard' })
  } catch (err) {
    // Error is handled by authStore
    console.error('Login error:', err)
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%);
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  margin: 0 0 0.5rem 0;
  color: var(--accent);
  font-size: 1.8rem;
}

.login-header p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.login-form {
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

.error-message {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  border-left: 3px solid #c33;
}

.oauth-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.oauth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #999;
  font-size: 0.85rem;
}

.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid #eee;
}

.oauth-btn {
  display: block;
  text-align: center;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  color: #333;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
}

.oauth-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.oauth-error {
  margin-top: 1rem;
}

.login-btn {
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

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(var(--accent-rgb), 0.4);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
}

.login-footer a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}

.login-footer a:hover {
  text-decoration: underline;
}

.login-footer hr {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid #eee;
}

.demo-info {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 6px;
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
}

.demo-info code {
  background: #eee;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: monospace;
  font-weight: 600;
}
</style>
