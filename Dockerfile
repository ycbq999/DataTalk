# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS frontend-dev
WORKDIR /app/frontend
RUN npm install --global pnpm@11.25.0
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY frontend/ ./

FROM frontend-dev AS frontend-build
RUN pnpm build

FROM python:3.13-slim-bookworm AS backend-dev
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --disable-pip-version-check --no-cache-dir --require-hashes -r requirements.txt
COPY backend/ ./

FROM backend-dev AS production
ENV UI_DIST_DIR=/app/ui
COPY --from=frontend-build /app/frontend/dist /app/ui
RUN DJANGO_DEBUG=1 THESISWATCH_SQLITE=1 \
    python manage.py collectstatic --noinput
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin thesiswatch
USER thesiswatch
EXPOSE 8000
CMD ["sh", "-c", "unset MIGRATION_DATABASE_URL MIGRATE_DB; exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --access-logfile - --error-logfile -"]
