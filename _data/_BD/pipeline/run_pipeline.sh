#!/usr/bin/env bash
# Полная пересборка базы azs_pult (схема azs) из CSV.
# Использование: run_pipeline.sh [папка_с_csv] [папка_результатов]
# По умолчанию CSV берутся из azs-pult-fullstack/_data/_BD/pipeline/data.
# Пароль берётся из переменной PGPASSWORD (задать явно перед запуском).
# Переменные: PGDATABASE, PGHOST, PGUSER, PGPASSWORD, PG_DUMP (путь к pg_dump той же версии, что сервер),
#             BACKUP_DIR (по умолчанию backups/), KEEP_BACKUPS (сколько копий хранить, по умолчанию 10),
#             LOG_DIR (по умолчанию logs/).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$(realpath "${1:-$HERE/data}")"
OUT="$(realpath -m "${2:-$HERE/out}")"
DB="${PGDATABASE:-azs_pult}"
export PGHOST="${PGHOST:-localhost}" PGUSER="${PGUSER:-postgres}"
: "${PGPASSWORD:?задайте PGPASSWORD}"
PSQL=(psql -h "$PGHOST" -U "$PGUSER" -v ON_ERROR_STOP=1 -q)
PG_DUMP="${PG_DUMP:-pg_dump}"
BACKUP_DIR="${BACKUP_DIR:-$HERE/backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
LOG_DIR="${LOG_DIR:-$HERE/logs}"

# Журнал: весь вывод идёт и в консоль, и в файл logs/run_<дата>.log
STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/run_$STAMP.log"
exec > >(tee -a "$LOG") 2>&1
log() { echo "[$(date '+%F %T')] $*"; }
trap 'log "ОШИБКА на строке $LINENO (код $?). Журнал: $LOG"' ERR
START=$SECONDS
log "Старт пересборки: база=$DB, CSV=$SRC, журнал=$LOG"

mkdir -p "$OUT"
cp "$HERE/transform.sql" "$OUT/"

# 1. Очистка CSV
log "Шаг 1: очистка CSV"
(cd "$SRC" && \
 python3 "$HERE/load_competitor_prices.py" competitor_prices.csv "$OUT/competitor_price_clean.csv" >/dev/null && \
 python3 "$HERE/load_all.py" "$OUT" >/dev/null && \
 python3 "$HERE/clean_promotions.py" "$OUT/promotion_clean.csv" >/dev/null)

# 2. Резервная копия существующей базы (если она есть) и хранение последних KEEP_BACKUPS копий
if "${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
  mkdir -p "$BACKUP_DIR"
  BK="$BACKUP_DIR/${DB}_$STAMP.dump"
  log "Шаг 2: резервная копия $DB -> $BK"
  "$PG_DUMP" -h "$PGHOST" -U "$PGUSER" -Fc -f "$BK" "$DB"
  ls -1t "$BACKUP_DIR"/"${DB}"_*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | while IFS= read -r old; do
    rm -f -- "$old"
    log "удалена старая копия $old"
  done || true
else
  log "Шаг 2: базы $DB нет, резервная копия не нужна"
fi

# 3. База, схема, загрузка
log "Шаг 3: создание базы (если нет), схемы и загрузка данных"
"${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
  || "${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB"
"${PSQL[@]}" -d "$DB" -f "$HERE/schema.sql"
(cd "$OUT" && python3 "$HERE/gen_load.py" "$SRC" "$OUT")
"${PSQL[@]}" -d "$DB" -f "$OUT/load.sql"

# 4. Правила заполнения и исключения
log "Шаг 4: правила заполнения и исключения"
"${PSQL[@]}" -d "$DB" -f "$HERE/post.sql"

# 4b. Синхронизация приложения (схема public) с новой выгрузкой
log "Шаг 4b: синхронизация схемы public (АЗС и данные приложения)"
"${PSQL[@]}" -d "$DB" -f "$HERE/sync_public.sql"
log "АЗС в приложении после синхронизации:"
"${PSQL[@]}" -d "$DB" -tAc "SELECT '  ' || name || ' | ' || coalesce(address,'') FROM public.azs ORDER BY name"

# 4c. Пересчёт рекомендаций по всем АЗС (включая новые)
log "Шаг 4c: пересчёт рекомендаций"
(cd "$HERE/../../../backend" && DB_HOST="$PGHOST" DB_USER="$PGUSER" DB_NAME="$DB" DB_PASSWORD="$PGPASSWORD" \
  npx ts-node -r tsconfig-paths/register src/scripts/generate-recommendations.ts)

# 5. Контроль
log "Шаг 5: контроль"
"${PSQL[@]}" -d "$DB" -c "SET search_path TO azs;" -c "
SELECT 'competitor_price' t, count(*) FROM competitor_price UNION ALL
SELECT 'fuel_daily', count(*) FROM fuel_daily UNION ALL
SELECT 'fuel price_filled', count(*) FROM fuel_daily WHERE price_filled UNION ALL
SELECT 'fuel sold no price', count(*) FROM fuel_daily WHERE price IS NULL AND sales_volume>0 UNION ALL
SELECT 'traffic_daily', count(*) FROM traffic_daily UNION ALL
SELECT 'promotion', count(*) FROM promotion UNION ALL
SELECT 'shop_sales_daily', count(*) FROM shop_sales_daily;"
log "Готово: $DB пересобрана из $SRC за $((SECONDS - START)) с"
