#!/bin/bash
set -e

echo "Running migrations..."
for f in /app/backend/migrations/*.sql; do
  echo "  Applying $f"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$f" 2>&1 || true
done
echo "Migrations done."

echo "Creating initial admin user if not exists..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT COUNT(*) FROM users;
" | grep -q "^ *0$" && python -c "
import os, psycopg2
from passlib.context import CryptContext
pwd = CryptContext(schemes=['bcrypt'])
conn = psycopg2.connect(host=os.environ['DB_HOST'], dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASS'])
cur = conn.cursor()
cur.execute(\"INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, 'admin') ON CONFLICT DO NOTHING\", ('admin', pwd.hash('changeme')))
conn.commit()
conn.close()
print('初期管理者ユーザーを作成しました: admin / changeme')
" || echo "ユーザーが既に存在するためスキップしました"

exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
