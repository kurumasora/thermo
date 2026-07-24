-- 傾向予測の記録・検証テーブル
CREATE TABLE IF NOT EXISTS trend_predictions (
    id SERIAL PRIMARY KEY,
    alert_history_id INTEGER REFERENCES alert_history(id) ON DELETE CASCADE,
    channel INTEGER NOT NULL,
    direction TEXT NOT NULL,          -- 'up' | 'down'
    limit_value FLOAT NOT NULL,       -- 到達予測する閾値
    predicted_at TIMESTAMPTZ NOT NULL, -- 閾値に達すると予測した時刻
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    outcome TEXT                      -- 'hit' | 'miss' | NULL(未検証)
);

-- 機能ON/OFFなどシステム設定テーブル
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO system_settings (key, value)
VALUES ('prediction_tracking', 'true')
ON CONFLICT (key) DO NOTHING;
