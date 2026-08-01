-- 既存テーブルを削除（データ破棄）
DROP TABLE IF EXISTS trend_predictions CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS measurements CASCADE;
DROP TABLE IF EXISTS master_config CASCADE;

-- センサ登録テーブル
CREATE TABLE sensors (
    id SERIAL PRIMARY KEY,
    sensor_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- チャンネル定義テーブル（センサごとのチャンネルと単位）
CREATE TABLE sensor_channels (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    channel_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    UNIQUE(sensor_id, channel_no)
);

-- 計測データ（縦持ち）
CREATE TABLE measurements (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    sensor_channel_id INTEGER NOT NULL REFERENCES sensor_channels(id) ON DELETE CASCADE,
    value FLOAT NOT NULL
);
CREATE INDEX idx_measurements_timestamp ON measurements(timestamp DESC);
CREATE INDEX idx_measurements_channel ON measurements(sensor_channel_id, timestamp DESC);

-- 閾値設定（チャンネルごと）
CREATE TABLE channel_config (
    id SERIAL PRIMARY KEY,
    sensor_channel_id INTEGER NOT NULL REFERENCES sensor_channels(id) ON DELETE CASCADE UNIQUE,
    upper_threshold FLOAT NOT NULL,
    lower_threshold FLOAT NOT NULL,
    slope_threshold FLOAT NOT NULL DEFAULT 0.3,
    regression_count INTEGER NOT NULL DEFAULT 10,
    trend_monitor BOOLEAN NOT NULL DEFAULT FALSE
);

-- アラート履歴
CREATE TABLE alert_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    sensor_channel_id INTEGER NOT NULL REFERENCES sensor_channels(id),
    alert_type TEXT NOT NULL,
    value FLOAT NOT NULL,
    message TEXT NOT NULL,
    predicted_steps FLOAT
);

-- 傾向予測記録
CREATE TABLE trend_predictions (
    id SERIAL PRIMARY KEY,
    alert_history_id INTEGER REFERENCES alert_history(id) ON DELETE CASCADE,
    sensor_channel_id INTEGER NOT NULL REFERENCES sensor_channels(id),
    direction TEXT NOT NULL,
    limit_value FLOAT NOT NULL,
    predicted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    outcome TEXT
);

-- 初期データ：おんどとりTR-7
INSERT INTO sensors (sensor_key, name) VALUES ('ondotori_1', 'おんどとりTR-7');

INSERT INTO sensor_channels (sensor_id, channel_no, name, unit) VALUES
    ((SELECT id FROM sensors WHERE sensor_key = 'ondotori_1'), 1, 'CH1温度', '℃'),
    ((SELECT id FROM sensors WHERE sensor_key = 'ondotori_1'), 2, 'CH2温度', '℃');

INSERT INTO channel_config (sensor_channel_id, upper_threshold, lower_threshold, slope_threshold, regression_count, trend_monitor) VALUES
    ((SELECT sc.id FROM sensor_channels sc JOIN sensors s ON s.id = sc.sensor_id WHERE s.sensor_key = 'ondotori_1' AND sc.channel_no = 1), 31.0, 22.0, 0.3, 10, TRUE),
    ((SELECT sc.id FROM sensor_channels sc JOIN sensors s ON s.id = sc.sensor_id WHERE s.sensor_key = 'ondotori_1' AND sc.channel_no = 2), 31.0, 22.0, 0.3, 10, TRUE);

-- 初期データ：仮想湿度センサ（テスト用）
INSERT INTO sensors (sensor_key, name, active) VALUES ('dummy_humidity', '仮想湿度センサ', FALSE);

INSERT INTO sensor_channels (sensor_id, channel_no, name, unit) VALUES
    ((SELECT id FROM sensors WHERE sensor_key = 'dummy_humidity'), 1, '湿度', '%');

INSERT INTO channel_config (sensor_channel_id, upper_threshold, lower_threshold, slope_threshold, regression_count, trend_monitor) VALUES
    ((SELECT sc.id FROM sensor_channels sc JOIN sensors s ON s.id = sc.sensor_id WHERE s.sensor_key = 'dummy_humidity' AND sc.channel_no = 1), 80.0, 30.0, 1.0, 10, FALSE);
