#!/bin/bash
set -e

echo "Running migrations..."
for f in /app/backend/migrations/*.sql; do
  echo "  Applying $f"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$f" 2>&1 || true
done
echo "Migrations done."

exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
