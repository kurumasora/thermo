from dotenv import load_dotenv
load_dotenv()

from backend.db import get_connection

SQL = """
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO app_settings (key, value)
VALUES ('monitor_interval_minutes', '10')
ON CONFLICT (key) DO NOTHING;
"""

conn = get_connection()
try:
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("app_settings テーブルを作成し、初期値を設定しました")
finally:
    conn.close()
