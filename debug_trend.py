from dotenv import load_dotenv
load_dotenv()
import numpy as np
from datetime import timezone
from backend.db import get_connection

CHANNEL_ID = 3

conn = get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT timestamp, value FROM measurements WHERE sensor_channel_id = %s ORDER BY timestamp DESC LIMIT 10",
    (CHANNEL_ID,)
)
rows = cur.fetchall()
conn.close()

print("最近10件のデータ（DESC）:")
for r in rows:
    print(f"  {r[0]}  {r[1]}")

ordered = list(reversed(rows))
UTC = timezone.utc
base_ts = ordered[0][0].replace(tzinfo=UTC)
x = np.array([((r[0].replace(tzinfo=UTC)) - base_ts).total_seconds() for r in ordered])
y = np.array([float(r[1]) for r in ordered])

coeffs = np.polyfit(x, y, 1)
slope_per_sec = coeffs[0]
slope_per_10min = slope_per_sec * 600
y_pred = np.polyval(coeffs, x)
ss_tot = np.sum((y - np.mean(y))**2)
r2 = 1 - np.sum((y - y_pred)**2) / ss_tot if ss_tot > 0 else 1.0

print(f"\n傾き: {slope_per_10min:.2f} %/10分")
print(f"R²:   {r2:.4f}")
print(f"slope_threshold: 10.0")
print(f"判定: {'異常' if abs(slope_per_10min) > 10 and r2 >= 0.75 else '正常'}")
