# Образ бэкенда АЗС-Пульт (Express + TypeScript).
# Сборка из папки azs-pult-fullstack (контекст нужен для sync_public.sql):
#   docker build -f backend/Dockerfile -t azs-pult-backend:latest .
#
# Секреты не входят в образ: DB_*, JWT_SECRET, BACKUP_DB_*, FRONTEND_URL передаются при запуске.

# ---------- Сборка ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---------- Запуск ----------
FROM node:24-alpine AS runtime

# pg_dump нужен для резервных копий; версия клиента должна быть не ниже версии сервера базы.
# Supabase (PostgreSQL 17): по умолчанию postgresql17-client.
# Self-hosted db/ (PostgreSQL 18): docker build --build-arg PG_CLIENT=postgresql18-client ...
ARG PG_CLIENT=postgresql17-client
RUN apk add --no-cache dumb-init ${PG_CLIENT} \
  && addgroup -g 1001 -S app && adduser -S app -u 1001 -G app

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    PG_DUMP_PATH=/usr/bin/pg_dump \
    LOG_DIR=/app/logs \
    BACKUP_DIR=/app/backups \
    SYNC_PUBLIC_SQL=/app/sql/sync_public.sql

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Миграции — SQL-файлы; для запуска миграций компилированный migrate.js ищет их рядом
COPY backend/src/database/migrations ./dist/database/migrations
COPY _data/_BD/pipeline/sync_public.sql ./sql/sync_public.sql

RUN mkdir -p /app/logs /app/backups && chown -R app:app /app/logs /app/backups
USER app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health >/dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
