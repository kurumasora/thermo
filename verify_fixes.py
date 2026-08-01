"""バグ修正の検証スクリプト"""
from dotenv import load_dotenv
load_dotenv()

print("=== #1: sensors.py — 404チェック ===")
import inspect
import backend.routers.sensors as s
src = inspect.getsource(s.toggle_sensor_active)
ok = 'status_code=404' in src and 'row is None' in src
print(f"404処理あり: {'OK' if ok else 'NG'}")

print()
print("=== #2: monitor.py — DB保存→Webhook順序 ===")
import backend.monitor as m
src = inspect.getsource(m.main)
idx_insert = src.find('INSERT INTO alert_history')
idx_webhook = src.find('TeamsWebhook().send')
print(f"INSERT位置={idx_insert}, Webhook位置={idx_webhook}")
print(f"DB保存が先: {'OK' if idx_insert < idx_webhook else 'NG'}")
print(f"rollback追加: {'OK' if 'conn.rollback()' in src else 'NG'}")

print()
print("=== #5: trend.py — predicted_at過去問題 ===")
from backend.judgement.trend import TrendJudgement
from backend.interfaces import MeasurementData
from datetime import datetime, timedelta, timezone

now = datetime.now()
# 現在値がすでに上限(80%)を超過中(最終値85%)
data = [
    MeasurementData(channel=1, value=round(78 + i * 1.5, 1), unit='%',
                    timestamp=(now - timedelta(seconds=(9 - i) * 10)).strftime('%Y-%m-%d %H:%M:%S'))
    for i in range(10)
]
t = TrendJudgement(slope_threshold=1.0, upper=80.0, lower=30.0, interval_minutes=10)
r = t.judge(data)
predicted = r.get('predicted_at')
# すでに超過中の場合はpredicted_steps=0、メッセージに「超過中」が含まれることを確認
already_exceeded = r.get('predicted_steps') == 0 and '超過中' in r.get('message', '')
# 未超過の場合はpredicted_atが過去にならないことを確認（5秒の余裕を持つ）
not_past = predicted is None or predicted >= datetime.now(timezone.utc) - timedelta(seconds=5)
ok = already_exceeded or not_past
print(f"is_abnormal: {r['is_abnormal']}")
print(f"predicted_steps=0かつ「超過中」メッセージ: {'OK' if already_exceeded else 'NG'}")
print(f"message: {r['message']}")

print()
print("=== #6: webhook.py — URL未設定時にValueError ===")
import os
import backend.notification.webhook as wh
orig = os.environ.pop('TEAMS_WEBHOOK_URL', None)
try:
    wh.TeamsWebhook()
    print("ValueError未発生: NG")
except ValueError as e:
    print(f"ValueError発生: OK ({e})")
except KeyError as e:
    print(f"KeyError発生(修正前の挙動): NG")
finally:
    if orig:
        os.environ['TEAMS_WEBHOOK_URL'] = orig

print()
print("=== #7: admin.py — パスワードリセット存在確認 ===")
import backend.routers.admin as a
src = inspect.getsource(a.reset_password)
ok = 'status_code=404' in src and 'SELECT id FROM users' in src
print(f"存在確認あり: {'OK' if ok else 'NG'}")

print()
print("=== #8: admin.py — roleバリデーション ===")
from pydantic import ValidationError
try:
    a.UserCreate(username='x', password='y', role='superadmin')
    print("UserCreate superadmin拒否: NG")
except ValidationError:
    print("UserCreate superadmin拒否: OK")
try:
    a.RoleUpdate(role='superadmin')
    print("RoleUpdate superadmin拒否: NG")
except ValidationError:
    print("RoleUpdate superadmin拒否: OK")

print()
print("=== #12: threshold.py — 閉じ括弧 ===")
from backend.judgement.threshold import ThresholdJudgement
d_over = MeasurementData(channel=1, value=85.0, unit='%', timestamp='2026-01-01 00:00:00')
d_under = MeasurementData(channel=1, value=20.0, unit='%', timestamp='2026-01-01 00:00:00')
tj = ThresholdJudgement(upper=80.0, lower=30.0)
r_over = tj.judge(d_over)
r_under = tj.judge(d_under)
print(f"上限メッセージ: {r_over['message']}")
print(f"上限末尾「）」: {'OK' if r_over['message'].endswith('）') else 'NG'}")
print(f"下限メッセージ: {r_under['message']}")
print(f"下限末尾「）」: {'OK' if r_under['message'].endswith('）') else 'NG'}")

print()
print("=== #14: monitor.py — ログパス環境変数化 ===")
src_full = inspect.getsource(m)
ok = 'MONITOR_LOG_PATH' in src_full and '/home/kuruma' not in src_full
print(f"ハードコード除去: {'OK' if ok else 'NG'}")

print()
print("=== #15: auth/utils.py — JWT失敗時ログ ===")
import backend.auth.utils as au
src = inspect.getsource(au.verify_token)
ok = 'logger.warning' in src
print(f"warningログあり: {'OK' if ok else 'NG'}")

print()
print("=== #16: Navbar.tsx — JWT期限切れチェック ===")
with open('frontend/src/components/Navbar.tsx') as f:
    nav_src = f.read()
ok = 'payload.exp' in nav_src and 'Date.now()' in nav_src
print(f"exp確認コードあり: {'OK' if ok else 'NG'}")
