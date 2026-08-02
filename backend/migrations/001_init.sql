CREATE TABLE IF NOT EXISTS sensors (
    id SERIAL PRIMARY KEY,
    sensor_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    webhook_url TEXT,
    webhook_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sensor_channels (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    channel_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    UNIQUE (sensor_id, channel_no)
);

CREATE TABLE IF NOT EXISTS channel_config (
    id SERIAL PRIMARY KEY,
    sensor_channel_id INTEGER NOT NULL UNIQUE REFERENCES sensor_channels(id) ON DELETE CASCADE,
    upper_threshold DOUBLE PRECISION NOT NULL,
    lower_threshold DOUBLE PRECISION NOT NULL,
    trend_monitor BOOLEAN NOT NULL DEFAULT FALSE,
    judgement_type TEXT DEFAULT 'linear',
    judgement_params JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS measurements (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    sensor_channel_id INTEGER NOT NULL REFERENCES sensor_channels(id) ON DELETE CASCADE,
    value DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_measurements_channel ON measurements (sensor_channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements (timestamp DESC);

CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    sensor_channel_id INTEGER NOT NULL REFERENCES sensor_channels(id),
    alert_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    message TEXT NOT NULL,
    predicted_steps DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smtp_config (
    id SERIAL PRIMARY KEY,
    host TEXT,
    port INTEGER DEFAULT 587,
    username TEXT,
    password TEXT,
    from_address TEXT
);

CREATE TABLE IF NOT EXISTS sensor_email_recipients (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    UNIQUE (sensor_id, email)
);
