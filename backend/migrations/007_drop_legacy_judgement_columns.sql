-- channel_config の旧カラムを削除（judgement_paramsに統合済み）
ALTER TABLE channel_config DROP COLUMN IF EXISTS slope_threshold;
ALTER TABLE channel_config DROP COLUMN IF EXISTS regression_count;
