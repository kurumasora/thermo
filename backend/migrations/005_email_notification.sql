-- SMTP共通設定（1行のみ使用）
CREATE TABLE IF NOT EXISTS smtp_config (
    id SERIAL PRIMARY KEY,
    host TEXT,
    port INTEGER DEFAULT 587,
    username TEXT,
    password TEXT,
    from_address TEXT
);

-- 初期行を挿入（未設定状態）
INSERT INTO smtp_config (id, host, port, username, password, from_address)
VALUES (1, NULL, 587, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- センサごとの通知設定
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT FALSE;

-- センサごとのメール通知先（1行1アドレス）
CREATE TABLE IF NOT EXISTS sensor_email_recipients (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    UNIQUE (sensor_id, email)
);
