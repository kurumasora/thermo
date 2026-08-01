-- チャンネルごとの判定方法設定
ALTER TABLE channel_config ADD COLUMN IF NOT EXISTS judgement_type TEXT DEFAULT 'linear';
ALTER TABLE channel_config ADD COLUMN IF NOT EXISTS judgement_params JSONB DEFAULT '{}';

-- 既存レコードに線形回帰のパラメータをJSONで移行
UPDATE channel_config SET
    judgement_type = 'linear',
    judgement_params = jsonb_build_object(
        'slope_threshold', slope_threshold,
        'regression_count', regression_count,
        'r2_threshold', 0.75
    )
WHERE judgement_type IS NULL OR judgement_type = 'linear';
