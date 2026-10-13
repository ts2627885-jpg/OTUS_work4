# PostgreSQL для АЗС-Пульт (версия совпадает с рабочей базой: 18.x)
FROM postgres:18-alpine

# Скрипты из initdb/ выполняются один раз, при создании пустого тома данных
COPY initdb/ /docker-entrypoint-initdb.d/
RUN chmod 755 /docker-entrypoint-initdb.d/*.sh

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
