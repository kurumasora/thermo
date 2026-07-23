"""
アラート通知テストスクリプト
実行方法: .venv/bin/python test_alert.py [threshold|trend]
  threshold : 閾値超過アラートのテスト
  trend     : 傾向異常アラートのテスト
"""
from dotenv import load_dotenv
load_dotenv()

import sys
from backend.interfaces import MeasurementData
from backend.judgement.threshold import ThresholdJudgement
from backend.judgement.trend import TrendJudgement
from backend.notification.webhook import TeamsWebhook
from backend.db import get_connection

def test_threshold():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT upper_threshold, lower_threshold FROM master_config WHERE channel = 1"
        )
        upper, lower = cur.fetchone()
        cur.close()
    finally:
        conn.close()

    data = MeasurementData(channel=1, value=upper + 1.5, unit="℃", timestamp="2026-07-23 00:00:00")
    judgement = ThresholdJudgement(upper=upper, lower=lower)
    result = judgement.judge(data)

    print(f"判定結果: {result}")
    if result["is_abnormal"]:
        webhook = TeamsWebhook()
        webhook.send(result["message"])
        print("Teams通知を送信しました。Teamsを確認してください。")
    else:
        print("異常なしと判定されました（閾値設定を確認してください）")

def test_trend():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT upper_threshold, lower_threshold, slope_threshold FROM master_config WHERE channel = 1"
        )
        upper, lower, slope_threshold = cur.fetchone()
        cur.close()
    finally:
        conn.close()

    # 傾き閾値を確実に超えるデータを生成
    step = slope_threshold + 0.3
    data_list = [
        MeasurementData(channel=1, value=24.0 + i * step, unit="℃", timestamp=f"2026-07-23 00:{i:02d}:00")
        for i in range(10)
    ]
    judgement = TrendJudgement(slope_threshold=slope_threshold, upper=upper, lower=lower)
    result = judgement.judge(data_list)

    print(f"判定結果: {result}")
    if result["is_abnormal"]:
        webhook = TeamsWebhook()
        webhook.send(result["message"])
        print("Teams通知を送信しました。Teamsを確認してください。")
    else:
        print("異常なしと判定されました（閾値設定を確認してください）")

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "threshold":
        test_threshold()
    elif mode == "trend":
        test_trend()
    else:
        print("使い方: .venv/bin/python test_alert.py [threshold|trend]")
        sys.exit(1)
