-- センサごとのTeams Webhook URLカラムを追加
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS webhook_url TEXT;
