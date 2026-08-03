"""
アラートテストスクリプト。
DBへのデータ挿入 + 閾値/傾向判定 + Teams通知まで一括実行する。

使い方:
  .venv/bin/python test_insert_dummy.py <mode> [sensor_key] [channel_no]

  mode:
    over   - 上限超過 → 閾値アラート
    under  - 下限超過 → 閾値アラート
    trend  - 急上昇トレンド → 傾向アラート
    normal - 正常値（アラートなし）
    list   - 登録済みセンサ一覧を表示

  sensor_key : センサキー（省略時: dummy_humidity）
  channel_no : チャンネル番号（省略時: 1）

例:
  .venv/bin/python test_insert_dummy.py over
  .venv/bin/python test_insert_dummy.py over ondotori_1 1
  .venv/bin/python test_insert_dummy.py trend dummy_humidity 1
  .venv/bin/python test_insert_dummy.py list
"""

import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from backend.db import get_connection
from backend.interfaces import MeasurementData
from backend.judgement.threshold import ThresholdJudgement
from backend.judgement.factory import create_judgement
from backend.notification.webhook import TeamsWebhook
from backend.notification.email import load_email_notifier


def list_sensors(cur):
    cur.execute("""
        SELECT s.sensor_key, s.name, s.active, sc.channel_no, sc.name, sc.unit,
               cc.upper_threshold, cc.lower_threshold
        FROM sensors s
        JOIN sensor_channels sc ON sc.sensor_id = s.id
        JOIN channel_config cc ON cc.sensor_channel_id = sc.id
        ORDER BY s.id, sc.channel_no
    """)
    rows = cur.fetchall()
    print("登録済みセンサ一覧:")
    print(f"  {'センサキー':<20} {'センサ名':<20} {'状態':<6} CH  {'チャンネル名':<12} 単位  上限    下限")
    print("  " + "-" * 80)
    for r in rows:
        active = "有効" if r[2] else "無効"
        print(f"  {r[0]:<20} {r[1]:<20} {active:<6} {r[3]:<4} {r[4]:<12} {r[5]:<6}{r[6]:<8}{r[7]}")


def get_channel_info(cur, sensor_key: str, channel_no: int):
    cur.execute("""
        SELECT sc.id, cc.upper_threshold, cc.lower_threshold,
               cc.trend_monitor, cc.judgement_type, cc.judgement_params,
               sc.name, s.name, sc.unit,
               s.webhook_url, s.webhook_enabled, s.email_enabled, s.id
        FROM sensor_channels sc
        JOIN sensors s ON s.id = sc.sensor_id
        JOIN channel_config cc ON cc.sensor_channel_id = sc.id
        WHERE s.sensor_key = %s AND sc.channel_no = %s
    """, (sensor_key, channel_no))
    return cur.fetchone()


def insert_measurement(cur, channel_id: int, value: float, unit: str, ts: datetime):
    cur.execute(
        "INSERT INTO measurements (sensor_channel_id, value, timestamp) VALUES (%s, %s, %s)",
        (channel_id, value, ts.strftime('%Y-%m-%d %H:%M:%S'))
    )
    print(f"  DB挿入: {ts.strftime('%Y-%m-%d %H:%M:%S')} → {value}{unit}")


def send_notifications(message: str, webhook_url, webhook_enabled: bool,
                       email_enabled: bool, email_recipients: list, email_notifier):
    if webhook_enabled:
        try:
            print("  Teams通知を送信中...")
            TeamsWebhook(webhook_url).send(message)
            print("  Teams送信完了")
        except Exception as e:
            print(f"  Teams送信エラー: {e}")

    if email_enabled and email_notifier and email_recipients:
        try:
            print(f"  メール通知を送信中... ({', '.join(email_recipients)})")
            email_notifier.send(email_recipients, message)
            print("  メール送信完了")
        except Exception as e:
            print(f"  メール送信エラー: {e}")
    elif email_enabled and not email_recipients:
        print("  メール通知: 通知先アドレスが未登録")
    elif email_enabled and not email_notifier:
        print("  メール通知: SMTP設定が未完了")


def run_threshold_check(cur, conn, channel_id: int, data: MeasurementData,
                        upper: float, lower: float, webhook_url: str,
                        webhook_enabled: bool, email_enabled: bool,
                        email_recipients: list, email_notifier):
    threshold = ThresholdJudgement(upper=upper, lower=lower)
    result = threshold.judge(data)
    if result["is_abnormal"]:
        print(f"  [閾値異常] {result['message']}")
        cur.execute(
            "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message) VALUES (%s, %s, %s, %s, %s)",
            (data.timestamp, channel_id, "threshold", data.value, result["message"])
        )
        conn.commit()
        send_notifications(result["message"], webhook_url, webhook_enabled,
                           email_enabled, email_recipients, email_notifier)
    else:
        print("  閾値異常なし")


def run_trend_check(cur, conn, channel_id: int, channel_no: int, data: MeasurementData,
                    upper: float, lower: float, judgement_type: str, judgement_params: dict,
                    webhook_url: str, webhook_enabled: bool, email_enabled: bool,
                    email_recipients: list, email_notifier):
    params = judgement_params or {}
    regression_count = int(params.get('regression_count', 50))
    cur.execute(
        "SELECT timestamp, value FROM measurements WHERE sensor_channel_id = %s ORDER BY timestamp DESC LIMIT %s",
        (channel_id, regression_count)
    )
    rows = cur.fetchall()
    trend_data = [
        MeasurementData(channel=channel_no, value=row[1], unit=data.unit, timestamp=str(row[0]))
        for row in rows
    ]
    judgement = create_judgement(judgement_type or 'linear', params, upper, lower)
    result = judgement.judge(trend_data)
    if result["is_abnormal"]:
        print(f"  [傾向異常] {result['message']}")
        cur.execute(
            "INSERT INTO alert_history (timestamp, sensor_channel_id, alert_type, value, message, predicted_steps) VALUES (%s, %s, %s, %s, %s, %s)",
            (data.timestamp, channel_id, "trend", data.value, result["message"], result.get("predicted_steps"))
        )
        conn.commit()
        send_notifications(result["message"], webhook_url, webhook_enabled,
                           email_enabled, email_recipients, email_notifier)
    else:
        print("  傾向異常なし")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'over'
    sensor_key = sys.argv[2] if len(sys.argv) > 2 else 'dummy_humidity'
    channel_no = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    conn = get_connection()
    cur = conn.cursor()

    if mode == 'list':
        list_sensors(cur)
        conn.close()
        return

    info = get_channel_info(cur, sensor_key, channel_no)
    if not info:
        print(f"エラー: センサが見つかりません (sensor_key={sensor_key}, channel_no={channel_no})")
        print("登録済みセンサを確認するには: .venv/bin/python test_insert_dummy.py list")
        conn.close()
        return

    channel_id, upper, lower, trend_monitor, judgement_type, judgement_params, ch_name, sensor_name, unit, webhook_url, webhook_enabled, email_enabled, sensor_id = info
    now = datetime.now()

    # メール通知先・SMTP設定を取得
    email_notifier = load_email_notifier(conn)
    cur.execute("SELECT email FROM sensor_email_recipients WHERE sensor_id = %s", (sensor_id,))
    email_recipients = [r[0] for r in cur.fetchall()]

    print(f"センサ: {sensor_name} / {ch_name}  (上限:{upper}{unit} 下限:{lower}{unit})")
    print(f"Teams通知: {'ON' if webhook_enabled else 'OFF'}  メール通知: {'ON' if email_enabled else 'OFF'}")
    if email_enabled:
        print(f"メール通知先: {', '.join(email_recipients) if email_recipients else '未登録'}")
    print(f"モード: {mode}")
    print()

    over_value = upper + 5
    under_value = lower - 5
    normal_value = round((upper + lower) / 2, 1)
    trend_start = round(lower + (upper - lower) * 0.5, 1)
    trend_end = round(upper + 2, 1)
    trend_values = [round(trend_start + i * (trend_end - trend_start) / 9, 1) for i in range(10)]

    if mode == 'over':
        print(f"【上限超過テスト】{over_value}{unit} を挿入 → 閾値判定 → 通知")
        insert_measurement(cur, channel_id, over_value, unit, now)
        conn.commit()
        data = MeasurementData(channel=channel_no, value=over_value, unit=unit, timestamp=now.strftime('%Y-%m-%d %H:%M:%S'))
        run_threshold_check(cur, conn, channel_id, data, upper, lower, webhook_url,
                            webhook_enabled, email_enabled, email_recipients, email_notifier)

    elif mode == 'under':
        print(f"【下限超過テスト】{under_value}{unit} を挿入 → 閾値判定 → 通知")
        insert_measurement(cur, channel_id, under_value, unit, now)
        conn.commit()
        data = MeasurementData(channel=channel_no, value=under_value, unit=unit, timestamp=now.strftime('%Y-%m-%d %H:%M:%S'))
        run_threshold_check(cur, conn, channel_id, data, upper, lower, webhook_url,
                            webhook_enabled, email_enabled, email_recipients, email_notifier)

    elif mode == 'trend':
        print(f"【急上昇トレンドテスト】10件挿入({trend_start}→{trend_end}{unit}) → 傾向判定 → 通知")
        for i, v in enumerate(trend_values):
            ts = now - timedelta(seconds=(9 - i) * 10)
            insert_measurement(cur, channel_id, v, unit, ts)
        conn.commit()
        last = MeasurementData(channel=channel_no, value=trend_values[-1], unit=unit, timestamp=now.strftime('%Y-%m-%d %H:%M:%S'))
        run_trend_check(cur, conn, channel_id, channel_no, last, upper, lower, judgement_type, judgement_params,
                        webhook_url, webhook_enabled, email_enabled, email_recipients, email_notifier)

    elif mode == 'normal':
        print(f"【正常値テスト】{normal_value}{unit} を挿入 → 判定（アラートなし）")
        insert_measurement(cur, channel_id, normal_value, unit, now)
        conn.commit()
        data = MeasurementData(channel=channel_no, value=normal_value, unit=unit, timestamp=now.strftime('%Y-%m-%d %H:%M:%S'))
        run_threshold_check(cur, conn, channel_id, data, upper, lower, webhook_url,
                            webhook_enabled, email_enabled, email_recipients, email_notifier)

    else:
        print(f"不明なモード: {mode}  (over / under / trend / normal / list)")

    conn.close()


if __name__ == '__main__':
    main()
