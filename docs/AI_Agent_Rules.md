# Правила для AI Агента по Генерации Рекомендаций
## АЗС-Пульт | Версия 2.1

**Дата:** 9 октября 2026
**Статус:** Активно
**Целевая аудитория:** AI agents, recommendation engine, automated decision systems

---

## 1. ОСНОВНЫЕ ПРИНЦИПЫ АГЕНТА

### 1.1 Миссия Агента
Автоматизированный анализ данных АЗС и генерация приоритизированных, действенных рекомендаций для менеджеров и аналитиков на основе:
- Динамических ценовых данных конкурентов
- Трафика и поведения клиентов
- Исторических продаж и прибыльности
- Сезонных и краткосрочных тренов

### 1.2 Ключевые Ограничения
1. **Безопасность данных**: Никогда не генерировать рекомендации без валидированных источников данных
2. **Конфиденциальность**: Не раскрывать конкретные цены конкурентов в публичных рекомендациях
3. **Консервативность**: При неуверенности (R² < 0.5) предлагать сбор доп. данных перед действием
4. **Соблюдение правил**: Все рекомендации должны соответствовать RULES.md

### 1.3 Логика Отказа
Агент должен отказать генерировать рекомендацию если:
- Данные отсутствуют или некомплетны (< 70% валидных точек за период)
- Цена ниже себестоимости (автоматический ОТКАЗ)
- Статистическая значимость недостаточна
- Конфликт с защитными правилами (PRICE-005)

---

## 2. ВХОДНЫЕ ДАННЫЕ И СИГНАЛЫ

### 2.1 Обязательные Входные Параметры
```
azs_id          : Integer - ID АЗС
period          : Enum [7d, 14d, 28d, 56d, 91d] - Период анализа
confidence_min  : Float [0.0-1.0] - Минимальная доверительность (default: 0.6)
priority_filter : Enum [ALL, URGENT, HIGH, MEDIUM, LOW] - Фильтр приоритета
max_recs        : Integer - Максимум рекомендаций в выводе (default: 10)
```

### 2.2 Данные из БД (реальные измерения)

Источники: две базы на сервере PostgreSQL 18, `azs_pult`:
- схема `azs` — аналитические данные, собирается пайплайном из CSV (`_BD/pipeline/`);
- схема `public` — данные приложения (станции, цены, продажи, погода).

Соответствие логических входов таблицам:
```
price_history       : azs.fuel_daily {station_code, sale_date, fuel_code, price, is_offered, price_filled}
sales_volume        : azs.fuel_daily {sales_volume} (литры по дням и топливу); public.sales_data {volume, revenue, date_recorded}
traffic_data        : azs.traffic_daily {cars, transporters, trucks, intensity_physical, density, speed, service_level}
cost_price          : НЕТ В БД — Себестоимость (₽/литр), задается извне
elasticity          : НЕТ В БД — вычисляется моделью по fuel_daily
elasticity_comp     : НЕТ В БД — вычисляется моделью по competitor_price
competitor_prices   : azs.competitor_price {competitor_id, fuel_code, observed_at, price, is_brand_price}
                      + azs.competitor {station_code, brand}; public.competitor_prices {azs_id, competitor_name, fuel_type, price}
weather_data        : azs.weather_daily {temperature_c, precipitation_mm, wind_speed_ms, weather_type}
                      public.weather_data {temperature, humidity, wind_speed, conditions}
shop_sales          : azs.shop_sales_daily {station_code, product_code, sale_date, revenue_rub} + azs.shop_product {group_name}
                      (маржа и количество штук в БД отсутствуют)
promotion_history   : azs.promotion {start_date, end_date, category, coverage, name}
                      (процент скидки и прирост выручки в БД отсутствуют)
traffic_sensors_health : НЕТ В БД — надежность сенсоров трафика, поставляется отдельным сервисом
```
Поля, помеченные «НЕТ В БД», агент получает из других источников или вычисляет. Если такого источника нет, соответствующие правила не выполняются и это фиксируется в metadata рекомендации.

### 2.3 Производные Метрики (вычисляются перед анализом)
```
price_premium       = current_price - competitor_median
price_gap           = abs(current_price - competitor_weighted_avg)
volume_trend        : Linear regression slope за период
volume_ma7          = Moving average за 7 дней
volume_yoy_change   = (volume_current_period / volume_same_period_last_year - 1) * 100
capture_rate        = (our_liters / total_market_liters) * 100
revenue_trend       : Linear regression slope
gross_margin        = (revenue - (volume * cost_price)) / revenue * 100
competitor_move_avg = Mean absolute change конкурентов за последние 3 дня
```

---

## 3. КАТЕГОРИИ АНАЛИЗА И ПРАВИЛА ГЕНЕРАЦИИ

### 3.1 ЦЕНООБРАЗОВАНИЕ (PRICE Rules)

#### Rule PRICE-001: Выравнивание цены с конкурентами
**Триггеры активации:**
- `price_gap > 0.5` (наша цена выше среднего конкурента на ≥ 0.5₽)
- `volume_trend < -0.5` (объем падает более чем на 0.5л/день)
- `elasticity < -1.5` (спрос эластичен)

**Логика генерации:**
```
effect_₽_per_day = abs(price_gap) × volume_ma7 × abs(elasticity)

IF effect_₽_per_day > 50:
    priority = "HIGH"
    IF competitor_move_avg > 0.3:
        priority = "URGENT"
        action_timeframe = "2-4 hours"
    ELSE:
        action_timeframe = "1 day"
ELSE:
    priority = "MEDIUM"
    action_timeframe = "3 days"

recommended_price = competitor_weighted_avg - 0.1  // 10 копеек льготы
```

**Формат рекомендации:**
- **Заголовок**: "Выравнивание цены с рынком"
- **Метрика эффекта**: "Потенциальный рост выручки: ₽{effect}/день"
- **Действие**: "Установить цену {recommended_price}₽/л"
- **Обоснование**: "Цена выше рынка на {price_gap}₽, спрос падает"

#### Rule PRICE-002: Защита от избыточной премии
**Триггеры:**
- `price_premium > maxPremium` (по умолчанию maxPremium = 0)
- `volume_trend < 0` одновременно
- `gross_margin > avg_margin + 15%`

**Логика:**
```
IF price > competitor_max AND volume_trend < -1:
    priority = "HIGH"
    recommendation = "Снизить цену на {price_premium}₽"
    reason = "Избыточная премия ведет к потере объемов"
ELSE:
    priority = "LOW"
    recommendation = "Рассмотреть снижение премии"
```

#### Rule PRICE-003: Оптимальная цена по эластичности
**Триггеры:**
- `elasticity calculated AND R² > 0.6`
- `current_price != optimal_price`

**Логика:**
```
// Парабола: Revenue = (price - cost) × Volume(price)
// Оптимум в точке максимума
optimal_price = cost_price + (competitor_avg - cost_price) × (abs(elasticity) / (abs(elasticity) + 1))

IF abs(optimal_price - current_price) > 0.2:
    potential_revenue_delta = (optimal_price - current_price) × volume_at_optimal
    
    IF potential_revenue_delta > 100:
        priority = "HIGH"
    ELSE:
        priority = "MEDIUM"
    
    recommendation = "Оптимальная цена {optimal_price}₽ может увеличить выручку на ₽{potential_revenue_delta}/день"
```

#### Rule PRICE-004: Тестирование цены при неуверенности
**Триггеры:**
- `R² < 0.36` (модель ненадежна)
- Последний месяц без значимых изменений цены

**Логика:**
```
test_prices = [current_price - 0.5, current_price, current_price + 0.5]
test_days = 2  // Каждый тест по 2 дня

recommendation = "A/B тест цены: протестировать {test_prices} по {test_days} дня каждую"
priority = "MEDIUM"
expected_result = "Собрать данные для построения модели спроса (R² > 0.6)"
```

#### Rule PRICE-005: Запрет убыточных цен (ABSOLUTE)
**Триггеры:**
- `current_price < cost_price`

**Логика:**
```
CRITICAL_ALERT = TRUE
priority = "URGENT"
action_timeframe = "IMMEDIATE"
recommendation = "КРИТИЧНО: Цена ниже себестоимости на {cost_price - current_price}₽. Увеличить немедленно."
recommendation_price = cost_price + 0.1  // Минимум выше себестоимости
```

---

### 3.2 ТРАФИК И ОБЪЕМЫ (TRAFFIC Rules)

#### Rule TRAFFIC-001: Падение доли заправок
**Триггеры:**
- `capture_rate < avg_capture_rate × 0.92` (падение > 8%)
- `volume_trend < -1.0` (падение > 1л/день)
- Период стабилен (нет погодных аномалий)

**Логика:**
```
loss_liters_per_day = (target_capture - current_capture) × market_volume_daily
loss_₽_per_day = loss_liters × current_price

IF loss_₽_per_day > 200:
    priority = "HIGH"
    message = "Потеря {loss_liters_per_day} л/день ({loss_₽_per_day}₽/день)"
    suggestion = "Проверить конкурентские цены, рассмотреть точечную скидку"
ELSE:
    priority = "MEDIUM"
```

#### Rule TRAFFIC-002: Растущий трафик
**Триггеры:**
- `vehicle_count_trend > 0.5` (растет > 0.5 авт./день)
- `capture_rate < avg_capture_rate × 1.1` (есть потенциал захвата)
- `traffic_sensors_health > 0.85`

**Логика:**
```
potential_volume = (market_volume * potential_capture) - current_volume
potential_revenue = potential_volume × current_price

recommendation = "Растущий трафик (+{vehicle_count_trend} авт./день). Потенциал: +{potential_volume}л/день (+₽{potential_revenue}/день)"
priority = "MEDIUM"
action = "Рассмотреть оптимизацию цены для захвата новых клиентов"
```

#### Rule TRAFFIC-003: Проверка качества данных
**Триггеры:**
- `traffic_sensors_health < 0.8`
- `missing_data_percent > 10%`

**Логика:**
```
IF traffic_sensors_health < 0.8:
    recommendation = "⚠️ Надежность датчиков трафика {traffic_sensors_health*100}%. Все рекомендации на основе трафика могут быть неточными."
    priority = "HIGH"
    action = "Проверить оборудование датчиков"
ELSE:
    priority = "INFO"
```

---

### 3.3 КОНКУРЕНТНЫЙ АНАЛИЗ (COMP Rules)

#### Rule COMP-001: Экстренная реакция на ход конкурента
**Триггеры:**
- `competitor_price_change < -0.4₽` (снижение ≥ 40 копеек)
- `volume_reaction < -0.3` (реакция клиентов: -30% или более)
- Конкурент находится в пределах 500м

**Логика:**
```
urgency = "CRITICAL"
response_time_max = "2-4 hours"

volume_impact = volume_before_competitor_move - volume_after_competitor_move
if volume_impact > 100:
    priority = "URGENT"
    urgency_score = 10
else:
    urgency_score = 8

recommendation = "Конкурент снизил цену на {competitor_price_change}₽. Риск потери {volume_impact}л/день ({volume_impact * current_price}₽/день)."

options = [
    {
        price: current_price - 0.2,
        impact: "Восстановить конкурентность, минимальная потеря маржи",
        expected_volume_recovery: "70%"
    },
    {
        price: current_price - 0.35,
        impact: "Полное восстановление объема, существенная потеря маржи",
        expected_volume_recovery: "95%"
    },
    {
        price: current_price,
        impact: "Не реагировать, рискуем потерей {volume_impact}л/день",
        expected_volume_recovery: "10%"
    }
]
```

#### Rule COMP-002: Тренд цен конкурентов
**Триггеры:**
- Для конкурентов за 120 дней R² > 0.5
- `competitor_trend > 0.05` (растут > 5 копеек/неделю)

**Логика:**
```
IF competitor_trend_direction == "UP":
    weeks_until_new_floor = competitor_price_forecast_date - current_date
    
    recommendation = "Цены конкурентов растут (+{competitor_trend}₽/неделю). За {weeks_until_new_floor} недель они вырастут еще на ≈{competitor_trend * weeks_until_new_floor}₽."
    priority = "MEDIUM"
    action = "Подготовиться к поднятию цены синхронно с рынком в течение {weeks_until_new_floor} недель"
```

#### Rule COMP-003: Чувствительность к ценам конкурентов
**Триггеры:**
- `elasticity_comp < -0.8` (спрос чувствителен к ценам конкурентов)

**Логика:**
```
IF elasticity_comp < -1.5:
    sensitivity_level = "ОЧЕНЬ ВЫСОКАЯ"
    interpretation = "Каждый +0.1₽ конкурента → потеря {abs(elasticity_comp) * 0.1}% наших объемов"
    priority = "HIGH"
    strategy = "Необходимо активно отслеживать цены конкурентов и реагировать в режиме реального времени"
    
ELSE IF elasticity_comp < -0.8:
    sensitivity_level = "ВЫСОКАЯ"
    interpretation = "Каждый +0.1₽ конкурента → потеря {abs(elasticity_comp) * 0.1}% наших объемов"
    priority = "MEDIUM"
```

---

### 3.4 АКЦИИ И СПЕЦИАЛЬНЫЕ ПРЕДЛОЖЕНИЯ (PROMO Rules)

#### Rule PROMO-001: ROI анализ акций
**Входные данные:** promotion_type, discount_percent, target_segment

**Логика:**
```
// Базовая формула
revenue_lost_to_discount = promotion_period_volume × current_price × discount_percent
revenue_gained = volume_increase × current_price
variable_costs_increase = volume_increase × cost_price
net_gain = revenue_gained - variable_costs_increase - revenue_lost_to_discount

ROI = net_gain / (marketing_cost + opportunity_cost)

IF ROI >= 1.0:
    priority = "HIGH"
    recommendation = "✅ Акция экономически оправдана. ROI = {ROI}. Ожидаемый прирост ₽{net_gain}/день"
    approval = TRUE
ELSE IF ROI >= 0.8:
    priority = "MEDIUM"
    recommendation = "⚠️ Слабая экономика акции. ROI = {ROI}. Рекомендовать только стратегического характера"
    approval = FALSE
ELSE:
    priority = "LOW"
    recommendation = "❌ Убыточная акция. ROI = {ROI}. Не рекомендуется."
    approval = FALSE
```

#### Rule PROMO-002: Оптимальный период для акций
**Логика:**
```
// Анализ по дням недели и сезону
weak_days = Find days where traffic < avg_traffic × 0.85

IF day_of_week IN ["Monday", "Tuesday", "Wednesday", "Thursday"]:
    baseline_demand = "Средняя"
    promotion_efficiency = 1.0
ELSE IF day_of_week IN ["Friday", "Saturday", "Sunday"]:
    baseline_demand = "Высокая"
    promotion_efficiency = 0.7  // Люди покупают так и так
    recommendation_note = "Выходные и пятница - плохое время для скидок. Естественный спрос высокий."

IF season IN ["Holiday", "Vacation"]:
    recommendation_note += " В отпусках спрос и так высокий, скидки неэффективны."
    promotion_efficiency *= 0.5

optimal_days = Find([d for d in last_90_days if traffic[d] < avg_traffic × 0.85])
recommended_dates = optimal_days.where(date is not holiday)
```

#### Rule PROMO-003: Частота и усталость от акций
**Логика:**
```
promos_last_30_days = Count(promotions where end_date in last 30 days)

IF promos_last_30_days >= 2:
    priority = "HIGH"
    recommendation = "⚠️ Чрезмерная частота акций ({promos_last_30_days} за месяц). Риск: деградация бренда, привыкание клиентов к скидкам."
    suggestion = "Сделайте 4-недельный перерыв перед следующей акцией"
ELSE IF promos_last_30_days == 1:
    recommendation = "✅ Темп приемлемый. Можно провести еще одну акцию не ранее чем через 2 недели"
ELSE:
    recommendation = "✅ Акции долго не было. Хороший момент для нового предложения"
```

---

### 3.5 АНАЛИЗ ТОВАРОВ (SHOP Rules)

#### Rule SHOP-001: ABC-анализ товаров
**Логика:**
```
// Сортировать товары по выручке
revenues = Sort(products, by='revenue', order='descending')

cumulative_revenue = 0
target_percent = 0.8

FOR EACH product IN revenues:
    cumulative_revenue += product.revenue
    cumulative_percent = cumulative_revenue / total_revenue
    
    IF cumulative_percent <= 0.2:
        product.category = "A"  // ТОП 20% товаров = 80% выручки
    ELSE IF cumulative_percent <= 0.5:
        product.category = "B"  // Средние товары
    ELSE:
        product.category = "C"  // Остаток

// Рекомендация
recommendation_A = "Категория A: Максимальное внимание. Контролировать наличие, оптимизировать цену, защищать маржу"
recommendation_B = "Категория B: Поддерживать через промо в нужные периоды"
recommendation_C = "Категория C: Рассмотреть сокращение ассортимента или переквалификацию в нишевые товары"
```

#### Rule SHOP-002: Оптимизация маржи по категориям
**Логика:**
```
optimal_margins = {
    "coffee": [0.60, 0.80],        // 60-80%
    "water": [0.25, 0.35],          // 25-35%
    "snacks": [0.40, 0.50],         // 40-50%
    "tobacco": [0.10, 0.15],        // 10-15%
    "beverages": [0.35, 0.45],      // 35-45%
    "hot_food": [0.45, 0.55]        // 45-55%
}

FOR EACH category IN shop_data:
    current_margin = category.margin_percent
    optimal_range = optimal_margins[category.name]
    
    IF current_margin < optimal_range[0]:
        action = "Увеличить цену"
        potential_gain = (optimal_range[0] - current_margin) × category.daily_units
        priority = "HIGH"
    ELSE IF current_margin > optimal_range[1]:
        action = "Рассмотреть промо или снижение цены для увеличения объема"
        priority = "MEDIUM"
    ELSE:
        action = "Маржа в норме"
        priority = "OK"
```

#### Rule SHOP-003: Cross-sell анализ
**Логика:**
```
// Найти пары товаров, часто покупаемые вместе
correlation_matrix = Calculate(products_bought_together)

FOR EACH pair IN correlation_matrix where correlation > 0.6:
    product_A = pair[0]
    product_B = pair[1]
    
    // Если маржа B выше, то bundle-предложение
    if product_B.margin > product_A.margin × 1.2:
        recommendation = "Bundle-предложение: {product_A} + {product_B} со скидкой {discount}%"
        expected_effect = "Увеличить продажи B на 15-25%"
```

#### Rule SHOP-004: Ассортимент и конкурентность
**Логика:**
```
// Сравнить ассортимент с конкурентами
missing_from_us = competitor_shops.items - our_shop.items
missing_profitable = Filter(missing_from_us, where='margin > 30%')

IF LEN(missing_profitable) > 3:
    priority = "MEDIUM"
    recommendation = "Рассмотреть добавление популярных товаров конкурентов: {missing_profitable}"
    potential_revenue = Estimate(missing_profitable)
```

---

### 3.6 СИСТЕМНЫЕ ПРАВИЛА (SYS Rules)

#### Rule SYS-001: Окна анализа
**Определение окон анализа:**
```
windows = {
    "7d": {
        purpose: "Краткосрочные тренды, реакция на ходы конкурентов",
        use_case: "Ежедневный анализ, оперативные решения",
        refresh: "Каждые 4 часа"
    },
    "14d": {
        purpose: "Двухнедельные тренды, эффект от изменений",
        use_case: "Еженедельный анализ, тактические решения",
        refresh: "Ежедневно в 18:00"
    },
    "28d": {
        purpose: "Месячные паттерны, сезонность",
        use_case: "Планирование акций, бюджет",
        refresh: "Еженедельно"
    },
    "56d": {
        purpose: "Двухмесячные циклы, бизнес циклы",
        use_case: "Стратегия, долгосроч. планы",
        refresh: "Раз в 2 недели"
    },
    "91d": {
        purpose: "Квартальные показатели, тренды полугодия",
        use_case: "Бизнес-отчеты, оценка квартала",
        refresh: "Раз в неделю"
    }
}
```

#### Rule SYS-002: Расписание обновления
**Логика:**
```
// Режим реального времени для критичных
IF priority == "URGENT":
    refresh_interval = "15 minutes"  // Проверять каждые 15 минут
    notification = "PUSH + EMAIL"

ELSE IF priority == "HIGH":
    refresh_interval = "4 hours"
    notification = "In-app + Email"

ELSE IF priority == "MEDIUM":
    refresh_interval = "Daily"
    notification = "In-app"

ELSE:  // LOW
    refresh_interval = "Weekly"
    notification = "None (dashboard only)"

// Главное расписание анализа
schedule = {
    "daily": "06:00 UTC+3",     // Основной дневной анализ
    "hourly": "Every hour",      // Краткосрочный анализ
    "emergency": "On trigger"    // PRICE-005, конкурент -0.4
}
```

#### Rule SYS-003: Хранение и история
**Логика:**
```
retention_policy = {
    "active_data": "90 days",          // В оперативной системе
    "archive": "2 years",              // В холодном хранилище
    "backup_history": "30+ days",      // Резервные копии
    "audit_logs": "1 year",            // История всех изменений
    "recommendations_archive": "1 year" // История всех рекомендаций
}

// Для каждой рекомендации сохранить
recommendation_record = {
    id: unique_id,
    timestamp: iso8601,
    azs_id: integer,
    rule_id: string,
    priority: enum,
    data_snapshot: json,        // Состояние данных момент рекомендации
    recommendation_text: string,
    predicted_effect: float,
    actual_effect: float,       // Заполнится постфактум
    user_action: enum,          // ACCEPTED, IGNORED, MODIFIED
    timestamp_resolved: datetime
}
```

---

## 4. ЛОГИКА ПРИОРИТИЗАЦИИ И КОНФЛИКТОВ

### 4.1 Матрица Приоритизации

| Приоритет | Ежедневный эффект | Сроки действия | Примеры |
|-----------|-------------------|----------------|---------|
| **URGENT** | > ₽500/день | 24 часа | Цена ниже себестоимости, конкурент -0.4 с объемом |
| **HIGH** | ₽100-500/день | 7 дней | Выравнивание цены, тренд потерь, акция ROI >1 |
| **MEDIUM** | ₽10-100/день | 30 дней | Оптимизация маржи, тренды конкурентов |
| **LOW** | < ₽10/день | Информационно | Рекомендации по ассортименту, статистика |

### 4.2 Правила Разрешения Конфликтов

**Иерархия Приоритета:**
```
1. PRICE-005 (Защита от убыточности) - АБСОЛЮТНЫЙ приоритет
2. PRICE-001 (Выравнивание) vs PROMO-001 (Акция)
   → Цена имеет приоритет, акция вторична
3. COMP-001 (Реакция на конкурента) vs PRICE-003 (Оптимизация)
   → Краткосроч. реакция первична, долгосроч. вторична
4. Локальная оптимизация (одна АЗС) vs Сетевая согласованность
   → Локальная первична, но ограничение: разница между АЗС сети < 1.5₽
5. Сохранение маржи vs Захват объема
   → Зависит от контекста (зона конкуренции vs монополь)
```

**Примеры конфликтов:**

**Конфликт 1: Цена vs Акция**
```
Сценарий: 
  - PRICE-001 рекомендует снижение цены на 0.3₽ (эффект ₽200/день)
  - PROMO-001 рекомендует акцию "Кофе -15%" (ROI 1.2, ₽150/день)

Разрешение:
  Выполнить снижение цены ПЕРВЫМ (выше ROI, простая реализация)
  Акцию отложить на 2 недели, чтобы не переутомить клиентов скидками
```

**Конфликт 2: Реакция на конкурента vs Оптимальная цена**
```
Сценарий:
  - Конкурент снизил цену на 0.4₽ (COMP-001: URGENT)
  - Модель говорит, что оптимум выше текущей цены на 0.15₽ (PRICE-003: MEDIUM)

Разрешение:
  Сначала среагировать на конкурента (2-4 часа)
  Потом (через 3-4 дня) проверить, вернулась ли цена конкурента
  Если вернулась - перейти к оптимизации
  Если не вернулась - адаптировать модель оптимума под новую реальность
```

**Конфликт 3: Маржа vs Объем**
```
Сценарий:
  - PRICE-002 предлагает снизить премию с 0.8₽ до 0.2₽ (потеря ₽60 маржи/день)
  - Прогноз: восстановить ₽350 выручки/день, но себестоимость -₽140, итог +₽150 выручки

Разрешение:
  Выполнить снижение (общая выгода +₽90 EBITDA/день)
  Установить A/B тест на 1-2 дня перед полным внедрением для верификации
```

---

## 5. ВХОДНЫЕ ПАРАМЕТРЫ И ПРОЦЕСС ГЕНЕРАЦИИ

### 5.1 API Агента

```json
{
  "agent_request": {
    "action": "generate_recommendations",
    "azs_id": 42,
    "period": "14d",
    "confidence_min": 0.6,
    "priority_filter": "ALL",
    "max_recommendations": 10,
    "include_rationale": true,
    "include_alternatives": false,
    "include_forecast": true,
    "user_role": "manager"
  },
  
  "data_sources": {
    "from_db": ["prices", "sales", "traffic", "competitors"],
    "from_cache": ["elasticity_model", "competitor_trends"],
    "refresh_if_older_than": "4 hours"
  }
}
```

### 5.2 Процесс Генерации

```
1. VALIDATE INPUT
   ├─ Проверить наличие обязательных полей
   ├─ Валидировать period, confidence_min, user_role
   └─ Отклонить если критичные данные отсутствуют

2. FETCH DATA
   ├─ Получить данные за период из БД
   ├─ Вычислить производные метрики
   ├─ Проверить качество данных (должно быть > 70% валидных)
   └─ На ошибке → Alert, не генерировать рекомендацию

3. CALCULATE METRICS
   ├─ price_premium, price_gap
   ├─ volume trends (slope, MA7, YoY)
   ├─ elasticity (regression)
   ├─ capture_rate, gross_margin
   └─ competitor_move_avg

4. EVALUATE RULES
   ├─ Пройти все 20+ правил последовательно
   ├─ Для каждого правила: проверить триггеры
   ├─ Если триггеры сработали → вычислить эффект и приоритет
   ├─ Сохранить рекомендацию в список
   └─ Подавить дублированные рекомендации (keep highest priority)

5. APPLY FILTERS
   ├─ Отфильтровать по confidence_min
   ├─ Отфильтровать по priority_filter
   ├─ Отсортировать по приоритету
   ├─ Ограничить до max_recommendations
   └─ Применить правила разрешения конфликтов

6. GENERATE OUTPUT
   ├─ Форматировать каждую рекомендацию
   ├─ Добавить rationale если requested
   ├─ Добавить alternatives если requested
   ├─ Добавить forecast если requested
   └─ Добавить metadata (timestamp, confidence, etc.)

7. STORE & LOG
   ├─ Сохранить в recommendation_records
   ├─ Логировать в audit_log
   └─ Отправить уведомления согласно Rule SYS-002
```

### 5.3 Формат Выходной Рекомендации

```json
{
  "recommendation": {
    "id": "REC-2026-10-07-42-001",
    "timestamp": "2026-10-07T10:30:00Z",
    "azs_id": 42,
    "rule_id": "PRICE-001",
    "priority": "HIGH",
    "confidence": 0.78,
    "urgency": "1 day",
    
    "title": "Выравнивание цены с конкурентами",
    "summary": "Наша цена выше рынка на 0.6₽. При снижении до рыночной ожидаем рост объема на 120л/день (+₽240/день).",
    
    "current_state": {
      "our_price": 55.5,
      "competitor_avg": 54.9,
      "price_gap": 0.6,
      "daily_volume": 1200,
      "daily_revenue": 66600
    },
    
    "recommendation": {
      "action": "SET_PRICE",
      "recommended_value": 54.8,
      "rationale": "Выравняться с конкурентами с минимальной льготой 0.1₽"
    },
    
    "expected_impact": {
      "volume_delta": 120,
      "volume_delta_percent": 10,
      "revenue_delta_per_day": 240,
      "margin_delta_per_day": -45,
      "ebitda_delta_per_day": 195,
      "confidence": 0.78
    },
    
    "alternatives": [
      {
        "action": "SET_PRICE",
        "value": 54.5,
        "rationale": "Больше льготы для агрессивного захвата",
        "expected_ebitda_delta": 320,
        "confidence": 0.65
      }
    ],
    
    "forecast": {
      "probability_of_success": 0.78,
      "competitor_reaction_likely": true,
      "estimated_response_time": "4-8 hours",
      "risk_factors": ["Конкурент может пойти еще ниже"]
    },
    
    "metadata": {
      "data_freshness": "2 hours",
      "model_reliability": 0.78,
      "user_role": "manager",
      "applicable_to": "single_azs"
    }
  }
}
```

---

## 6. ПРАВИЛА ДЛЯ РАЗНЫХ РОЛЕЙ ПОЛЬЗОВАТЕЛЕЙ

### 6.1 Рекомендации для Manager
- Показывать: HIGH, URGENT, MEDIUM
- Скрывать: детали модели, сырые данные
- Формат: Понятные действия, четкие цифры эффекта
- Обновление: Ежедневно, уведомления на HIGH+

### 6.2 Рекомендации для Analyst
- Показывать: ВСЕ приоритеты включая LOW
- Показывать: Детали моделей, R², доверительные интервалы
- Формат: С полными объяснениями, альтернативы, прогнозы
- Обновление: Каждые 4 часа, все уведомления

### 6.3 Рекомендации для Viewer
- Показывать: URGENT + HIGH (только статистика)
- Скрывать: Рекомендации по действиям
- Формат: "Ситуационный отчет" без advice
- Обновление: Ежедневно

### 6.4 Рекомендации для Admin
- Показывать: ВСЕ включая отладочную информацию
- Доступ: К параметрам всех правил, к override'ам
- Формат: Техническое, с логированием
- Обновление: В реальном времени

---

## 7. ОБРАБОТКА ОШИБОК И ГРАНИЧНЫЕ СЛУЧАИ

### 7.1 Отсутствие или неполные данные
```
IF missing_data_percent > 30%:
    confidence *= (1 - missing_data_percent)
    
IF missing_data_percent > 50%:
    REJECT_RECOMMENDATION("Недостаточно данных для анализа")
```

### 7.2 Экстремальные значения
```
IF price < cost_price:
    FORCE_PRIORITY("URGENT")
    CONFIDENCE = 1.0
    
IF volume_change > 50% OR < -50%:
    FLAG_AS_ANOMALY
    confidence *= 0.5  // Уменьшить доверие
    require_manual_review = true
```

### 7.3 Модель неконсистентна
```
IF elasticity_comp and elasticity have opposite signs:
    confidence *= 0.7
    add_note("Поведение клиентов неконсистентно, требуется анализ")
    
IF R² < 0.3 for critical model:
    REJECT_PREDICTION
    RECOMMEND("Собрать больше данных или провести тест")
```

### 7.4 Рекомендация уже выполнена
```
IF current_price == recommended_price AND days_since_change < 3:
    STATUS = "ALREADY_IMPLEMENTED"
    SUPPRESS_DUPLICATE = true
```

---

## 8. ВЕРСИОНИРОВАНИЕ И ОБНОВЛЕНИЕ ПРАВИЛ

### 8.1 История Версий

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-09-15 | Начальный набор 16 правил |
| 1.5 | 2026-09-28 | Добавлены SHOP-001..004, улучшена PROMO |
| 2.0 | 2026-10-07 | Полный AI Agent Rules, детализирована логика |
| 2.1 | 2026-10-09 | Раздел 2.2 приведен к реальной схеме БД (azs и public); отмечены поля, которых нет в БД |

### 8.2 Процесс Обновления Правил
1. Proposal в RULES.md → версионирование
2. A/B тест на 5% АЗС
3. Если точность улучшилась > 5% → rollout
4. Документировать в changelog

---

## 9. МОНИТОРИНГ КАЧЕСТВА РЕКОМЕНДАЦИЙ

### 9.1 KPI Агента
```
Метрика                        | Целевое значение
------------------------------|------------------
Accuracy (рекомендация → факт) | > 70%
Precision (избегать ложных)    | > 80%
Coverage (доля АЗС в анализе)  | > 85%
Response time (генерация)       | < 2 seconds
User acceptance rate            | > 60%
Revenue impact positive         | > 75% правил
```

### 9.2 Feedback Loop
```
1. User applies recommendation
   └─ Store actual_effect
   
2. System compares predicted vs actual
   └─ If difference > 20%, flag for model retraining
   
3. Aggregate feedback for all rules
   └─ Monthly accuracy report
   
4. If accuracy < 65% for rule:
   └─ Deprecate rule or retrain parameters
```

---

## 10. ПРИМЕРЫ СЦЕНАРИЕВ ГЕНЕРАЦИИ

### Сценарий 1: Обычное утро
```
Время: 06:00 UTC+3 (плановый запуск)
Данные за ночь обновлены

EVALUATE RULES:
✓ PRICE-001: Цена на 0.3₽ выше, объем стабилен → LOW (мониторинг)
✓ TRAFFIC-001: Трафик падает -3% WoW → HIGH (нужна реакция)
✓ COMP-001: Конкурент стабилен → OK
✗ PROMO-001: Нет активных акций → N/A
✓ SHOP-001: ABC-анализ: категория A прибыльна → OK

OUTPUT:
1. TRAFFIC-001: HIGH - Падение доли. Рассмотреть скидку на отдельные часы
2. PRICE-001: LOW - Мониторинг цены конкурентов
```

### Сценарий 2: Экстренная ситуация
```
Время: 14:30 (запуск обнаружения аномалии)
Событие: Конкурент снизил цену с 54.9 до 54.0₽

EVALUATE RULES:
✓ COMP-001: Ход конкурента > -0.4₽ И объем падает → URGENT (24h)
✓ PRICE-005: Наша цена 55.2 > себестоимости 52.0 → OK
✓ PRICE-002: Премия упала с 0.8 до 1.2₽ → Ситуация ухудшилась

OUTPUT:
1. COMP-001: URGENT - Конкурент снизил на 0.9₽! Риск потери ₽450/день
   Опции:
   - Снизить на 0.4₽ → восстановить 70% объема
   - Снизить на 0.6₽ → восстановить 95% объема
   - Не реагировать → потеря ₽450/день

Notification: PUSH + CALL Manager
```

### Сценарий 3: Анализ акции
```
Время: 18:00 (плановая генерация)
Запрос: Можно ли провести акцию "Кофе -20%" на следующий вторник?

EVALUATE RULES:
✓ PROMO-001: ROI analysis
  - Base coffee revenue: ₽2400/день × 20% = -₽480 скидка
  - Ожидаемый рост объема: +30% (historical data)
  - Additional revenue: 2400 × 0.3 = +₽720
  - Cost increase: ₽720 × 0.35 (себестоимость) = -₽252
  - Net: +₽720 - ₽480 - ₽252 = -₽12
  - ROI = -₽12 / ₽100 (marketing) = -0.12
  - → REJECT ❌

✓ PROMO-002: Timing analysis
  - Вторник: neutral day, OK для скидок
  - Seasonality: Q4, coffee consumption up ✓
  - But ROI negative, skip this promotion

OUTPUT:
PROMO-001: REJECTED - Экономика неудовлетворительна (ROI = -0.12)
Альтернатива: Подождать до ноября (higher demand) или снизить скидку до -10%
```

---

**Конец документа AI_Agent_Rules.md**

Этот документ описывает полный набор правил и логики для автоматического AI агента, генерирующего рекомендации.
