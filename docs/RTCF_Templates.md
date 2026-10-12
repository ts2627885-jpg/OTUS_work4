# RTCF Шаблоны для AI-разработчика
## Структурированные промпты для Cursor, Windsurf, Aider, Cline

**Версия:** 1.0  
**Дата:** 7 октября 2026  
**Проект:** АЗС-Пульт  
**Назначение:** Быстрые шаблоны для типичных сценариев разработки

---

## 📌 Введение в RTCF

**RTCF** — структурированный формат для эффективного взаимодействия с AI-разработчиком:

- **Role** — Роль AI в контексте задачи
- **Task** — Конкретная задача, что нужно сделать
- **Context** — Контекстная информация (код, архитектура, ограничения)
- **Format** — Требуемый формат результата

Эта структура гарантирует, что AI точно понимает, что вы хотите, и выдает результат нужного качества.

---

# 🔧 ШАБЛОН #1: Генерация Компонента/Функции по Описанию

## Когда использовать
- Нужен новый Vue компонент для UI
- Нужна новая функция-сервис для backend
- Нужна хелпер-функция для обработки данных
- Нужен полностью новый модуль

## Структура RTCF

```markdown
## Role
Backend Developer / Frontend Developer (выбери в зависимости от контекста)
Опытный разработчик компонентов/сервисов с глубоким пониманием архитектуры.
Знаешь best practices, patterns и production-ready code.

## Task
Создать [название компонента/функции] для [назначение].
Компонент/функция должен:
- [Требование 1]
- [Требование 2]
- [Требование 3]

## Context
**Проект:** АЗС-Пульт  
**Стек:** [Vue 3 / Node.js + Express / TypeScript]  
**Архитектура:** [Описание где будет использоваться]  
**Зависимости:** [Какие пакеты/модули доступны]  
**Ограничения:** [Любые ограничения производительности, безопасности]  
**Существующий код:** [Ссылка на похожие компоненты/функции]

## Format
Структурированный код с:
- TypeScript типизацией (без `any`)
- JSDoc комментариями для каждого метода
- Примером использования в комментариях
- Unit-тест stub'ом (jest/vitest)
- Файловая структура согласно architect_prompt.md
```

## Пример использования

```markdown
## Role
Frontend Developer (Vue 3 компоненты)
Опытный разработчик с пониманием Pinia state management и TypeScript.

## Task
Создать компонент **PriceHistory** для отображения исторических данных цен АЗС.
Компонент должен:
- Отображать граммик цены за последние 30 дней
- Показывать текущую цену, минимальную и максимальную
- Позволять переключаться между периодами (7d, 14d, 28d, 30d)
- Быть адаптивным для мобильных устройств
- Загружать данные через API при смене периода

## Context
**Проект:** АЗС-Пульт  
**Стек:** Vue 3, TypeScript, Pinia, Tailwind CSS, Recharts  
**Архитектура:** Компонент будет использоваться на странице Dashboard  
**Зависимости:** 
- recharts для графиков
- date-fns для работы с датами
- axios для API запросов
**Ограничения:** 
- Load time < 2 сек для 30 дней данных
- Поддержка светлой и темной темы
**Существующий код:** Посмотри Dashboard.vue и useAnalytics.ts

## Format
1. Файл `PriceHistory.vue` с:
   - TypeScript setup script с типами
   - Реактивное состояние через ref/reactive
   - Методы: loadData(), handlePeriodChange()
   - JSDoc для каждого метода
   - Пример использования в комментарии
2. Файл `usePriceHistory.ts` (composable) для логики загрузки
3. Jest тест-stub: PriceHistory.spec.ts
4. Краткий README как использовать компонент
```

---

# 📝 ШАБЛОН #2: Рефакторинг Кода с Улучшением

## Когда использовать
- Код работает но выглядит не оптимально
- Нужны улучшения: производительность, читаемость, безопасность
- Нужно перейти на новую версию библиотеки
- Нужно привести в соответствие со стандартами architect_prompt.md

## Структура RTCF

```markdown
## Role
Code Reviewer & Architect
Знаешь best practices, производительность, безопасность.
Фокусируешься на читаемости и maintainability.

## Task
Рефакторить код функции/компонента `[название]` для:
- Улучшения производительности (с [текущее] до [целевое])
- Улучшения читаемости и maintainability
- Соответствия стандартам architect_prompt.md
- Устранения technical debt в [области]

## Context
**Текущий код:**
[Вставь полный код функции/компонента]

**Проблемы текущей реализации:**
- [Проблема 1: что не так]
- [Проблема 2: что не так]
- [Проблема 3: что не так]

**Требования:**
- Сохранить текущий API (или обнови если необходимо)
- [Любые другие требования]

**Ограничения:**
- Не менять параметры функции
- Поддержка [версии браузеров/Node]

## Format
1. **Улучшенный код** с объяснением каждого изменения
2. **Таблица сравнения** before/after по метрикам:
   - Производительность
   - Читаемость (Lines of Code, Cyclomatic Complexity)
   - Безопасность (если applicable)
3. **Миграционный гайд** если API изменился
4. **Тесты** для проверки эквивалентности
```

## Пример использования

```markdown
## Role
Code Reviewer & Performance Optimizer
Специалист по оптимизации Vue компонентов и уменьшению re-renders.

## Task
Рефакторить компонент `PriceTable.vue` для:
- Уменьшения re-renders при изменении фильтров
- Улучшения производительности с 150ms до <50ms на сортировку
- Привести в соответствие Vue 3 composition API best practices
- Убрать deprecated методов и vuex

## Context
**Текущий код:**
[Полный код PriceTable.vue]

**Проблемы:**
- Компонент пересчитывается при каждом изменении одного фильтра
- Используется Vuex вместо Pinia
- Сложная логика смешана в template
- Нет memoization для дорогих операций

**Требования:**
- Сохранить текущий props interface
- События должны остаться те же
- Должна работать с существующим Pinia store

**Ограничения:**
- Vue 3.3+
- Не менять структуру DOM (для CSS совместимости)

## Format
1. Рефакторенный код с inline comments объясняющими WHY
2. Таблица изменений:
   | Метрика | До | После |
   |---------|-----|--------|
   | Re-renders при фильтре | 5 | 1 |
   | Sort time (1000 rows) | 150ms | 45ms |
   | Complexity (McCabe) | 12 | 7 |
3. Миграционный гайд для других компонентов использующих PriceTable
4. Jest тесты для проверки поведения
```

---

# 🧪 ШАБЛОН #3: Написание Тестов для Существующего Кода

## Когда использовать
- Новый код без тестов
- Старый код, который никогда не тестировался
- Нужно увеличить code coverage
- Нужны e2e тесты для критичных сценариев

## Структура RTCF

```markdown
## Role
QA Engineer & Test Architect
Экспертиза в unit, integration, e2e тестировании.
Знаешь как тестировать разные типы кода: async, UI, API, DB.

## Task
Написать тесты для [модуля/компонента/функции] с coverage >= [X%].
Нужны тесты для:
- [Сценарий 1: happy path]
- [Сценарий 2: edge case]
- [Сценарий 3: error handling]

## Context
**Код для тестирования:**
[Вставь код функции/компонента/сервиса]

**Существующие тесты (если есть):**
[Ссылка на существующие тесты или "нет тестов"]

**Зависимости & Мокирование:**
- [API endpoints которые нужно замокировать]
- [Database calls]
- [External services]

**Требования к тестам:**
- Framework: [Jest / Vitest / Vue Test Utils]
- Coverage: [% минимум]
- [Любые specific scenarios]

## Format
Тестовый файл с:
- Clear describe/test структурой (AAA: Arrange, Act, Assert)
- Мокированием external dependencies
- Fixtures/factories для тестовых данных
- Comments объясняющими non-obvious тесты
- Coverage report (jest --coverage)
```

## Пример использования

```markdown
## Role
QA Engineer & Full-Stack Test Specialist
Опытность в Jest, Vitest, Vue Test Utils, Supertest.

## Task
Написать тесты для сервиса `PricingService.ts` с coverage >= 85%.
Нужны тесты для:
- Happy path: calculateOptimalPrice() с валидными входами
- Edge cases: деление на 0, отрицательные значения, null
- Error handling: база недоступна, API timeout
- Integration: реальное взаимодействие с repository

## Context
**Код для тестирования:**
```typescript
export class PricingService {
  async analyzePricing(azsId: number, period: string): Promise<IPricingAnalysis>
  private calculateElasticity(history: IPriceHistory[]): IElasticityModel
  private calculateOptimalPrice(...): number
}
```

**Dependencies to mock:**
- PricingRepository.getPriceHistory()
- PricingRepository.getCompetitorPrices()
- logger.warn()

**Требования:**
- Jest с ts-jest
- Coverage >= 85%
- Timeout для async операций <= 5000ms
- Группировка тестов по методам

**Restrictions:**
- Не менять класс PricingService
- Не менять public API
- Тесты должны проходить < 2 сек

## Format
1. Файл `PricingService.spec.ts` с:
   - describe() блоками по методам
   - beforeEach() с setup фиксчур
   - Минимум 15 тест-케йсов
   - Моки для всех external dependencies
   - AAA структура (Arrange, Act, Assert)
   
2. Файлы с test fixtures:
   - `fixtures/priceHistory.fixture.ts` - тестовые данные
   - `mocks/PricingRepository.mock.ts` - моки repository
   
3. Jest config включение ts-jest
4. Coverage report показывающий покрытие каждого метода
```

---

# 🐛 ШАБЛОН #4: Исправление Ошибок и Багов

## Когда использовать
- Найден bug в коде
- Тесты падают
- Runtime ошибка в production
- Performance issue

## Структура RTCF

```markdown
## Role
Bug Fixer & Debugger
Логически мыслишь, умеешь отследить root cause.
Фокусируешься на быстром и надежном решении.

## Task
Найти и исправить bug в [модуле/компоненте].
Bug: [Описание проблемы: что происходит, что должно происходить]

## Context
**Симптомы:**
- [Поведение 1]
- [Поведение 2]
- [Error message / Stack trace if available]

**Как воспроизвести:**
[Шаги для репродукции]

**Код с bagом:**
[Вставь релевантный код]

**Версия / Окружение:**
- [Node version / Browser / OS]
- [Версии зависимостей если relevant]

**Гипотезы (если есть):**
- [Что может быть причиной]
- [Альтернативные причины]

## Format
1. **Root cause analysis** - точное объяснение что пошло не так
2. **Фиксированный код** с пояснениями
3. **Проверочные шаги** - как убедиться что баг исправлен
4. **Регрессионный тест** - тест чтобы баг не повторился
5. **Если есть edge cases** - как их избежать в будущем
```

## Пример использования

```markdown
## Role
Backend Bug Fixer & Database Specialist
Опыт отладки async операций, race conditions, database issues.

## Task
Исправить баг в CSV импорте.
Bug: При импорте CSV > 50k строк задача зависает на 50%, потом падает с "timeout error"

## Context
**Симптомы:**
- Импорт 10k строк работает нормально
- Импорт 50k+ строк: зависает после ~50%, потом Error: "Transaction timeout"
- В логах видно что переходит на строку 25-30k и больше не видно логов

**Как воспроизвести:**
1. Генерируешь CSV с 60k строк (любых данных)
2. Загружаешь через UI Import Data
3. Смотришь logs в консоли backend
4. ~1 минута и видишь "Transaction timeout"

**Код с bagом:**
```typescript
async importCSV(file: Buffer): Promise<ImportResult> {
  const rows = parseCSV(file);
  const results = [];
  
  for (const row of rows) {
    const model = transformRow(row);
    await db.query('INSERT INTO fuel_sales VALUES(...)', params);  // ❌ One by one
    results.push(model);
  }
}
```

**Версия:**
- Node 20.10.0
- PostgreSQL 14.5
- Transaction timeout: 30s (default)

**Гипотезы:**
- Каждый INSERT отдельно медленно, N+1 проблема
- Transaction timeout для одной большой транзакции
- Памятью проблема

## Format
1. Root cause analysis объясняющий проблему
2. Исправленный код с batch inserts
3. Performance сравнение: 10k (500ms) vs 50k (2s) vs 100k (4s)
4. Регрессионный тест что импорт 100k работает < 10s
5. Рекомендации для еще больших файлов (1M+)
```

---

# 🎯 ШАБЛОН #5: Декомпозиция Сложной Задачи на Подзадачи

## Когда использовать
- Большая эпик которую нужно разбить на истории
- Сложная фича которую нужно реализовать поэтапно
- Не ясно с какого конца начать большой рефакторинг
- Нужен планета план развития для нового модуля

## Структура RTCF

```markdown
## Role
Project Architect & Tech Lead
Видишь full picture архитектуры, dependencies, risks.
Умеешь break down complex problems на manageable chunks.

## Task
Разбить сложную задачу "[название]" на подзадачи/этапы.
Каждая подзадача должна:
- Быть implementable за 1-3 дня (4-12 story points)
- Иметь четкие acceptance criteria
- Не иметь циклических зависимостей
- Давать промежуточную ценность

## Context
**Описание задачи:**
[Полное описание что нужно сделать]

**Требования:**
- [Функциональные требования]
- [Non-functional requirements]

**Ограничения:**
- Deadline: [если есть]
- Ресурсы: [сколько разработчиков]
- Зависимости: [от других систем/команд]

**Архитектура:**
[Описание как это вписывается в систему]

**Existing work:**
[Что уже сделано, на что можно опираться]

## Format
1. **Dependency Graph** - визуальное представление порядка подзадач
2. **Таблица подзадач:**
   | # | Подзадача | Зависит от | Est. | Критерии приема |
   |---|-----------|-----------|------|-----------------|
   
3. **Для каждой подзадачи:**
   - Название и описание (2-3 предложения)
   - Acceptance criteria (SMART)
   - Technical notes (как реализовать)
   - Risk factors (если есть)
   - Test strategy
   
4. **Интеграционный тест план**
5. **Rollout plan** - как задеплоить после реализации
```

## Пример использования

```markdown
## Role
Product Architect & Full-Stack Tech Lead
Специалист в decomposition, project planning, risk management.

## Task
Разбить эпик "Система рекомендаций для АЗС" на реализуемые подзадачи.
Каждая подзадача должна быть completable за 2-5 дней и давать промежуточную ценность.

## Context
**Описание задачи:**
Разработать систему AI-рекомендаций которая:
- Анализирует данные цен, трафика, конкурентов
- Генерирует 20+ бизнес-правил (из RULES.md)
- Показывает рекомендации в UI
- Позволяет менеджерам применять рекомендации
- Логирует и отслеживает эффект рекомендаций

**Требования:**
- API response < 2s для генерации рекомендаций
- UI load < 1s
- Должна работать для 500+ АЗС
- Поддержка 4 ролей пользователей
- Регулярные обновления каждые 4 часа

**Ограничения:**
- Deadline: 2 месяца
- Team: 2 backend, 1 frontend, 1 QA
- DB: PostgreSQL, не можем менять схему кардинально
- Existing: Есть база цен, трафика, конкурентов

**Архитектура:**
- Backend: Node/Express + PricingService + RulesEngine
- Frontend: Vue 3 + Dashboard + RecommendationPanel
- DB: Новая таблица recommendations

## Format
1. **Dependency Graph** показывающий порядок реализации

2. **Таблица с 12-15 подзадачами:**
   
   | # | Подзадача | Зависит от | Est. | Owner |
   |---|-----------|-----------|------|-------|
   | 1 | Backend: DB schema для recommendations | - | 1d | Backend |
   | 2 | Backend: Rules engine skeleton | 1 | 2d | Backend |
   | 3 | Backend: PRICE-001..005 реализация | 2 | 3d | Backend |
   | 4 | Backend: TRAFFIC-001..003 реализация | 2 | 2d | Backend |
   | 5 | Backend: COMP-001..003 реализация | 2 | 2d | Backend |
   | 6 | Backend: API endpoints для recommendations | 3-5 | 2d | Backend |
   | 7 | Frontend: Dashboard layout для рекомендаций | - | 1d | Frontend |
   | 8 | Frontend: RecommendationCard компонент | 7 | 1d | Frontend |
   | 9 | Frontend: Фильтры и сортировка рекомендаций | 7,8 | 1d | Frontend |
   | 10 | Backend: Логирование и tracking результатов | 6 | 1d | Backend |
   | 11 | Тестирование: Unit tests для rules | 3-5 | 2d | QA |
   | 12 | Тестирование: E2E тесты workflow | 6,9 | 2d | QA |
   | 13 | Документация: API docs + deployment guide | 6 | 1d | Backend |

3. **Детали каждой подзадачи (пример #3):**

   ### 3. Backend: PRICE-001..005 реализация
   
   **Описание:**
   Реализовать 5 основных правил для оптимизации цен:
   - PRICE-001: Выравнивание с конкурентами
   - PRICE-002: Защита от избыточной премии
   - PRICE-003: Оптимальная цена по эластичности
   - PRICE-004: Тестирование цены
   - PRICE-005: Запрет убыточных цен
   
   **Acceptance Criteria:**
   - [ ] Все 5 правил реализованы в TypeScript
   - [ ] Каждое правило возвращает рекомендацию с приоритетом
   - [ ] PRICE-005 сработает мгновенно если цена < себестоимости
   - [ ] Unit тесты: 100% coverage для каждого правила
   - [ ] Performance: обработка 1000 АЗС < 5 сек
   - [ ] API docs добавлены в Swagger
   
   **Technical Notes:**
   - Используй PricingService который уже есть
   - Каждое правило = отдельный метод в RulesEngine
   - Данные берешь из PricingRepository (существует)
   - Результаты сохраняй в таблице recommendations
   - Используй Pinia logger для debug output
   
   **Risks:**
   - Может быть медленным на больших объемах данных → используй caching
   - Elasticity модель может быть недостаточно точной → используй confidence threshold
   
   **Test Strategy:**
   - Unit tests с mock data
   - Integration test с реальной БД (staging)
   - Load test с 500 АЗС

4. **Интеграционный тест план:**
   После реализации каждой подзадачи проверить:
   - API отвечает за 1-2 сек
   - UI корректно отображает рекомендации
   - Логирование работает
   - Рекомендации применяются и сохраняются

5. **Rollout Plan:**
   - Week 1-2: Backend основные правила + initial testing
   - Week 3: Frontend UI реализация
   - Week 4: Integration & end-to-end testing
   - Week 5: Staging deployment + production ready
   - Week 6: Soft launch (10% пользователей)
   - Week 7: Full production rollout
```

---

# 💡 СОВЕТЫ ПО ИСПОЛЬЗОВАНИЮ RTCF ШАБЛОНОВ

## Как правильно заполнить RTCF

### Role (Роль)
- ✅ Конкретная и описательная: "Senior Backend Developer specializing in performance optimization"
- ❌ Слишком общая: "A developer"
- ✅ Добавь контекст опыта: "с 5+ годами опыта в Node.js"

### Task (Задача)
- ✅ Четкая и actionable: "Refactor calculatePrice() to handle >1M rows in < 500ms"
- ❌ Расплывчатая: "Make it better"
- ✅ Используй глаголы: Create, Refactor, Test, Fix, Optimize, Design
- ✅ Включи criteria успеха: "with 95% accuracy and <100ms response time"

### Context (Контекст)
- ✅ Вставь релевантный код (не весь проект)
- ✅ Укажи зависимости и constraints
- ✅ Описи existing solution или similar code
- ❌ Не забывай про ограничения (performance, security, browser support)
- ✅ Укажи version constraints: "Vue 3.3+", "Node 20+"

### Format (Формат)
- ✅ Специфичный и детальный: "TypeScript interfaces, JSDoc, jest tests"
- ❌ Общий: "code"
- ✅ Укажи структуру: "describe blocks, AAA pattern, fixtures"
- ✅ Укажи что НЕ нужно: "no inline styles, use Tailwind CSS classes"

## Комбинирование шаблонов

Можно комбинировать шаблоны для сложных задач:

```markdown
## Генерация компонента + Написание тестов

**Используй шаблон #1 для основного задания + шаблон #3 для требования тестов**

## Role
Frontend Developer & QA Engineer
[Combined roles for both tasks]

## Task
Создать компонент PriceOptimizer (Template #1)
+ Написать unit + E2E тесты (Template #3)

## Context
[Combined context from both templates]

## Format
[Combined output: Component + Tests + Documentation]
```

## Итеративный процесс

RTCF отлично работает для итеративной разработки:

```
1. Шаблон #5: Разбить эпик на подзадачи
   ↓
2. Для каждой подзадачи: Шаблон #1 (создать компонент)
   ↓
3. Шаблон #3 (написать тесты)
   ↓
4. Если есть баги: Шаблон #4 (исправить)
   ↓
5. Если нужен рефакторинг: Шаблон #2 (улучшить)
```

---

# 📚 Примеры одной фразой

Быстрые примеры как начать с каждым шаблоном:

### Шаблон #1
> "Роль: Senior Frontend Developer. Создать компонент PriceChart для отображения истории цен. Контекст: Vue 3, Recharts, TypeScript. Формат: .vue файл + composable + jest тест."

### Шаблон #2
> "Роль: Code Reviewer. Рефакторить функцию elasticityCalculate() для производительности. Контекст: текущая сложность O(n²), нужна O(n). Формат: оптимизированный код + benchmark before/after."

### Шаблон #3
> "Роль: QA Engineer. Написать тесты для AuthService.ts. Контекст: 90% coverage, тестовать login/register/logout. Формат: jest тесты + fixtures + моки."

### Шаблон #4
> "Роль: Bug Fixer. Исправить баг: CSV импорт зависает на >50k строк. Контекст: timeout ошибка, N+1 problem. Формат: фиксированный код + регрессионный тест."

### Шаблон #5
> "Роль: Tech Lead. Разбить эпик 'Recommendation Engine' на подзадачи. Контекст: 2 месяца, team из 4 человек. Формат: Dependency graph + таблица подзадач + timeline."

---

## 🎓 Резюме

**Эти 5 шаблонов помогут вам:**
- Четко формулировать требования для AI-разработчика ✅
- Получать более качественный результат ✅
- Сэкономить время на переделки ✅
- Структурировать большие задачи ✅
- Улучшать код и тестовое покрытие ✅

**Помни:** чем лучше заполнишь RTCF, тем лучше будет результат от AI-разработчика!

---

**Версия:** 1.0  
**Последнее обновление:** 7 октября 2026  
**Статус:** Production Ready  
**Лицензия:** Project Internal
