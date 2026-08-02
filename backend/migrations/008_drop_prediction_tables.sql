-- 予測精度機能を廃止
DROP TABLE IF EXISTS trend_predictions;
DELETE FROM system_settings WHERE key = 'prediction_tracking';
