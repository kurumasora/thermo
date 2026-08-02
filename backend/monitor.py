from dotenv import load_dotenv
load_dotenv()

import logging
import os
from backend.devices.sensor_map import SENSOR_MAP
from backend.judgement.threshold import ThresholdJudgement
from backend.judgement.factory import create_judgement
from backend.judgement.prediction import is_prediction_tracking_enabled, save_prediction, verify_past_predictions
from backend.notification.webhook import TeamsWebhook
from backend.notification.email import load_email_notifier
from backend.db import get_connection

_log_path = os.environ.get("MONITOR_LOG_PATH", "monitor.log")
logging.basicConfig(
    filename=_log_path,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def send_notifications(message: str, sensor_webhook_url, webhook_enabled: bool,
                       email_enabled: bool, email_recipients: list[str], email_notifier):
    if webhook_enabled:
        try:
            TeamsWebhook(sensor_webhook_url).send(message)
        except Exception as e:
            logger.error(f"Teams通知エラー: {e}")

    if email_enabled and email_notifier and email_recipients:
        try:
            email_notifier.send(email_recipients, message)
        except Exception as e:
            logger.error(f"メール通知エラー: {e}")


def main():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # SMTP設定を読み込む（未設定ならNone）
        email_notifier = load_email_notifier(conn)

        # アクティブなセンサをDBから取得
        cur.execute("""
            SELECT id, sensor_key, name, webhook_url, webhook_enabled, email_enabled
            FROM sensors WHERE active = TRUE
        """)
        active_sensors = cur.fetchall()

        for sensor_id, sensor_key, sensor_name, sensor_webhook_url, webhook_enabled, email_enabled in active_sensors:
            if sensor_key not in SENSOR_MAP:
                logger.warning(f"未登録センサ: {sensor_key}")
                continue

            # メール通知先を取得
            cur.execute(
                "SELECT email FROM sensor_email_recipients WHERE sensor_id = %s",
                (sensor_id,)
            )
            email_recipients = [r[0] for r in cur.fetchall()]

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
                    """SELECT upper_threshold, lower_threshold, trend_monitor,
                              judgement_type, judgement_params
                       FROM channel_config WHERE sensor_channel_id = %s""",
                    (channel_id,)
                )
                config = cur.fetchone()
                if config is None:
                    continue
                upper, lower, trend_monitor, judgement_type, judgement_params = config

                # 閾値異常判定
                threshold = ThresholdJudgement(upper=upper, lower=lower)
                result = threshold.judge(data)
                if result["is_abnormal"]:
                    cur.execute(
                        "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message) VALUES (%s, %s, %s, %s, %s)",
                        (data.timestamp, channel_id, "threshold", data.value, result["message"])
                    )
                    conn.commit()
                    logger.warning(f"閾値異常: {result['message']}")
                    send_notifications(
                        result["message"], sensor_webhook_url,
                        webhook_enabled, email_enabled, email_recipients, email_notifier
                    )

                # 傾向異常判定
                if trend_monitor:
                    params = judgement_params or {}
                    regression_count = int(params.get('regression_count', 10))

                    cur.execute(
                        "SELECT timestamp, value FROM measurements WHERE sensor_channel_id = %s ORDER BY timestamp DESC LIMIT %s",
                        (channel_id, regression_count)
                    )
                    rows = cur.fetchall()
                    trend_data = [
                        data.__class__(channel=data.channel, value=row[1], unit=data.unit, timestamp=str(row[0]))
                        for row in rows
                    ]

                    try:
                        judgement = create_judgement(judgement_type or 'linear', params, upper, lower)
                    except ValueError as e:
                        logger.error(f"{sensor_key} 判定クラス生成エラー: {e}")
                        continue

                    trend_result = judgement.judge(trend_data)

                    if trend_result["is_abnormal"]:
                        cur.execute(
                            "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message, predicted_steps) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                            (data.timestamp, channel_id, "trend", data.value, trend_result["message"], trend_result["predicted_steps"])
                        )
                        alert_id = cur.fetchone()[0]
                        conn.commit()
                        logger.warning(f"傾向異常アラート: {trend_result['message']}")
                        send_notifications(
                            trend_result["message"], sensor_webhook_url,
                            webhook_enabled, email_enabled, email_recipients, email_notifier
                        )

                        if is_prediction_tracking_enabled() and trend_result.get("predicted_at") is not None:
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
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
