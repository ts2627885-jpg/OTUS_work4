import { describe, it, expect } from 'vitest'
import { errorMessage } from '@/composables/useRequest'

describe('errorMessage (обработка ошибок запросов)', () => {
  it('сетевая ошибка без ответа: понятный текст, а не «Network Error»', () => {
    expect(errorMessage({ message: 'Network Error' })).toBe('Нет связи с сервером. Проверьте подключение или попробуйте позже.')
  })

  it('таймаут: отдельный текст', () => {
    expect(errorMessage({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' }))
      .toBe('Сервер не ответил вовремя. Попробуйте ещё раз.')
  })

  it('401: предлагает войти снова', () => {
    expect(errorMessage({ response: { status: 401, data: { error: 'Invalid credentials' } } }))
      .toBe('Сессия истекла. Войдите снова.')
  })

  it('403: показывает текст сервера (ошибка доступа), иначе общий текст', () => {
    expect(errorMessage({ response: { status: 403, data: { error: 'Недостаточно прав' } } })).toBe('Недостаточно прав')
    expect(errorMessage({ response: { status: 403, data: {} } })).toBe('Недостаточно прав для этого действия.')
  })

  it('500: общий текст, без деталей сервера', () => {
    expect(errorMessage({ response: { status: 500, data: { error: 'relation "x" does not exist' } } }))
      .toBe('Внутренняя ошибка сервера. Попробуйте позже.')
  })

  it('400 (валидация): текст ошибки сервера как есть', () => {
    expect(errorMessage({ response: { status: 400, data: { error: 'Укажите название станции' } } }))
      .toBe('Укажите название станции')
  })

  it('404: текст сервера или общий', () => {
    expect(errorMessage({ response: { status: 404, data: { error: 'Станция не найдена' } } })).toBe('Станция не найдена')
    expect(errorMessage({ response: { status: 404, data: {} } })).toBe('Данные не найдены.')
  })

  it('пустая ошибка: общий текст', () => {
    expect(errorMessage(undefined)).toBe('Неизвестная ошибка')
  })
})
