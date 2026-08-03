from dotenv import load_dotenv
load_dotenv()

import logging
import os
from datetime import datetime, timedelta
from backend.devices.sensor_map import SENSOR_MAP
from backend.judgement.threshold import ThresholdJudgement
from backend.judgement.factory import create_judgement
from backend.notifiers.webhook import TeamsWebhook
from backend.notifiers.email import load_email_notifier
from backend.db import get_connection

_log_path = os.environ.get("MONITOR_LOG_PATH", "logs/monitor.log")
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

        # インターバル設定を読み込み、前回実行から経過していなければスキップ
        cur.execute("SELECT value FROM app_settings WHERE key = 'monitor_interval_minutes'")
        row = cur.fetchone()
        interval_minutes = int(row[0]) if row else 10
        cur.execute(
            "SELECT MAX(timestamp) FROM measurements"
        )
        last_row = cur.fetchone()
        last_ts = last_row[0] if last_row else None
        if last_ts and datetime.now(tz=last_ts.tzinfo) - last_ts < timedelta(minutes=interval_minutes):
            logger.info(f"インターバル未経過のためスキップ (間隔: {interval_minutes}分, 最終: {last_ts})")
            return

        # SMTP設定を読み込む（未設定ならNone）
        email_notifier = load_email_notifier(conn)

        # アクティブなセンサをDBから取得
        cur.execute("""
            SELECT id, sensor_key, name, webhook_url, webhook_enabled, email_enabled
            FROM sensors WHERE active = TRUE
        """)
        active_sensors = cur.fetchall()

        # 全センサのデータを先取りし、ondotoriのタイムスタンプを基準として共有する
        sensor_data_map: dict = {}
        reference_timestamp: str | None = None
        for sensor_id, sensor_key, *_ in active_sensors:
            if sensor_key not in SENSOR_MAP:
                continue
            try:
                device = SENSOR_MAP[sensor_key]()
                data_list = device.get_data()
                sensor_data_map[sensor_key] = data_list
                if sensor_key == 'ondotori_1' and data_list:
                    reference_timestamp = data_list[0].timestamp
            except Exception as e:
                logger.error(f"{sensor_key} データ取得エラー: {e}", exc_info=True)

        # ondotoriのタイムスタンプがDBに未登録（新データ）のときだけ他センサに適用する
        # ondotoriデバイスが旧タイムスタンプを返し続けるケースで他センサが詰まるのを防ぐ
        ondotori_timestamp_is_new = False
        if reference_timestamp:
            cur.execute(
                """SELECT 1 FROM measurements m
                   JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
                   JOIN sensors s ON s.id = sc.sensor_id
                   WHERE s.sensor_key = 'ondotori_1' AND m.timestamp = %s LIMIT 1""",
                (reference_timestamp,)
            )
            ondotori_timestamp_is_new = cur.fetchone() is None

        if ondotori_timestamp_is_new:
            for sensor_key, data_list in sensor_data_map.items():
                if sensor_key != 'ondotori_1':
                    for d in data_list:
                        d.timestamp = reference_timestamp

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

            data_list = sensor_data_map.get(sensor_key)
            if not data_list:
                continue

            # チャンネルマッピング: channel_no → sensor_channel_id
            cur.execute(
                "SELECT channel_no, id FROM sensor_channels WHERE sensor_id = %s",
                (sensor_id,)
            )
            channel_map = {row[0]: row[1] for row in cur.fetchall()}

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
                THRESHOLD_COOLDOWN_MINUTES = 60
                threshold = ThresholdJudgement(upper=upper, lower=lower)
                result = threshold.judge(data)
                if result["is_abnormal"]:
                    # 同チャンネルの直近クールダウン期間内に閾値アラートがあればスキップ
                    cur.execute(
                        """SELECT 1 FROM alert_history
                           WHERE sensor_channel_id = %s AND alert_type = 'threshold'
                             AND timestamp >= NOW() - INTERVAL '%s minutes' LIMIT 1""",
                        (channel_id, THRESHOLD_COOLDOWN_MINUTES)
                    )
                    if cur.fetchone() is not None:
                        logger.info(f"閾値アラートをクールダウン中のためスキップ: CH{data.channel}")
                        continue
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
                    # regression_countはjudgement_paramsから取得。未定義の判定方法は直近50件を上限として取得
                    regression_count = int(params.get('regression_count', 50))

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
                            """SELECT 1 FROM alert_history
                               WHERE sensor_channel_id = %s AND alert_type = 'trend'
                                 AND timestamp >= NOW() - INTERVAL '%s minutes' LIMIT 1""",
                            (channel_id, THRESHOLD_COOLDOWN_MINUTES)
                        )
                        if cur.fetchone() is not None:
                            logger.info(f"傾向アラートをクールダウン中のためスキップ: CH{data.channel}")
                            continue
                        cur.execute(
                            "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message, predicted_steps) VALUES (%s, %s, %s, %s, %s, %s)",
                            (data.timestamp, channel_id, "trend", data.value, trend_result["message"], trend_result["predicted_steps"])
                        )
                        conn.commit()
                        logger.warning(f"傾向異常アラート: {trend_result['message']}")
                        send_notifications(
                            trend_result["message"], sensor_webhook_url,
                            webhook_enabled, email_enabled, email_recipients, email_notifier
                        )

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
