from dotenv import load_dotenv
load_dotenv()

import logging
from backend.devices.ondotori import OndotoriDevice
from backend.devices.dummy_sensor import DummyHumiditySensor
from backend.judgement.threshold import ThresholdJudgement
from backend.judgement.trend import TrendJudgement
from backend.judgement.prediction import is_prediction_tracking_enabled, save_prediction, verify_past_predictions
from backend.notification.webhook import TeamsWebhook
from backend.db import get_connection

logging.basicConfig(
    filename="/home/kuruma/thermo/monitor.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# 新しいセンサを追加するときはここにクラスを追加する
SENSOR_MAP = {
    'ondotori_1': OndotoriDevice,
    'dummy_humidity': DummyHumiditySensor,
}


def main():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # アクティブなセンサをDBから取得
        cur.execute("SELECT id, sensor_key, name FROM sensors WHERE active = TRUE")
        active_sensors = cur.fetchall()

        for sensor_id, sensor_key, sensor_name in active_sensors:
            if sensor_key not in SENSOR_MAP:
                logger.warning(f"未登録センサ: {sensor_key}")
                continue

            try:
                device = SENSOR_MAP[sensor_key]()
                data_list = device.get_data()
            except Exception as e:
                logger.error(f"{sensor_key} データ取得エラー: {e}", exc_info=True)
                continue

            if not data_list:
                continue

            # チャンネルマッピング: channel_no → sensor_channel_id
            cur.execute(
                "SELECT channel_no, id FROM sensor_channels WHERE sensor_id = %s",
                (sensor_id,)
            )
            channel_map = {row[0]: row[1] for row in cur.fetchall()}

            # 重複チェック（最初のチャンネルのタイムスタンプで判定）
            first_channel_id = channel_map.get(data_list[0].channel)
            if first_channel_id:
                cur.execute(
                    "SELECT id FROM measurements WHERE timestamp = %s AND sensor_channel_id = %s",
                    (data_list[0].timestamp, first_channel_id)
                )
                if cur.fetchone() is not None:
                    logger.info(f"{sensor_key}: 重複スキップ ({data_list[0].timestamp})")
                    continue

            # 計測データを保存
            for data in data_list:
                channel_id = channel_map.get(data.channel)
                if channel_id is None:
                    logger.warning(f"{sensor_key} CH{data.channel}: channel_id 未登録")
                    continue
                cur.execute(
                    "INSERT INTO measurements (timestamp, sensor_channel_id, value) VALUES (%s, %s, %s)",
                    (data.timestamp, channel_id, data.value)
                )
            conn.commit()
            logger.info(f"{sensor_key}: データ保存 {data_list[0].timestamp}")

            # 各チャンネルの異常判定
            for data in data_list:
                channel_id = channel_map.get(data.channel)
                if channel_id is None:
                    continue

                cur.execute(
                    "SELECT upper_threshold, lower_threshold, slope_threshold, regression_count, trend_monitor FROM channel_config WHERE sensor_channel_id = %s",
                    (channel_id,)
                )
                config = cur.fetchone()
                if config is None:
                    continue
                upper, lower, slope_threshold, regression_count, trend_monitor = config

                # 閾値異常判定
                threshold = ThresholdJudgement(upper=upper, lower=lower)
                result = threshold.judge(data)
                if result["is_abnormal"]:
                    webhook = TeamsWebhook()
                    webhook.send(result["message"])
                    cur.execute(
                        "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message) VALUES (%s, %s, %s, %s, %s)",
                        (data.timestamp, channel_id, "threshold", data.value, result["message"])
                    )
                    conn.commit()
                    logger.warning(f"閾値異常: {result['message']}")

                # 傾向異常判定
                if trend_monitor:
                    cur.execute(
                        "SELECT timestamp, value FROM measurements WHERE sensor_channel_id = %s ORDER BY timestamp DESC LIMIT %s",
                        (channel_id, regression_count)
                    )
                    rows = cur.fetchall()
                    trend_data = [
                        data.__class__(channel=data.channel, value=row[1], unit=data.unit, timestamp=str(row[0]))
                        for row in rows
                    ]

                    trend = TrendJudgement(slope_threshold=slope_threshold, upper=upper, lower=lower, interval_minutes=10)
                    trend_result = trend.judge(trend_data)

                    if trend_result["is_abnormal"]:
                        webhook = TeamsWebhook()
                        webhook.send(trend_result["message"])
                        cur.execute(
                            "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message, predicted_steps) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                            (data.timestamp, channel_id, "trend", data.value, trend_result["message"], trend_result["predicted_steps"])
                        )
                        alert_id = cur.fetchone()[0]
                        conn.commit()
                        logger.warning(f"傾向異常: {trend_result['message']}")

                        if is_prediction_tracking_enabled():
                            save_prediction(
                                alert_history_id=alert_id,
                                sensor_channel_id=channel_id,
                                direction=trend_result["direction"],
                                limit_value=trend_result["limit_value"],
                                predicted_at=trend_result["predicted_at"],
                            )

        if is_prediction_tracking_enabled():
            verify_past_predictions()

    except Exception as e:
        logger.error(f"monitor.py 実行エラー: {e}", exc_info=True)
        raise
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
