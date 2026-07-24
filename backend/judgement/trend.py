import numpy as np
from datetime import datetime, timedelta, timezone
from backend.interfaces import MeasurementData

JST = timezone(timedelta(hours=9))
UTC = timezone.utc

# タイムスタンプ文字列をUTC aware datetimeに変換
def _parse_ts(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def _r2(y: np.ndarray, y_pred: np.ndarray) -> float:
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    if ss_tot == 0:
        return 1.0
    return float(1 - np.sum((y - y_pred) ** 2) / ss_tot)


class TrendJudgement:
    def __init__(self, slope_threshold: float, upper: float, lower: float,
                 interval_minutes: int = 10, r2_threshold: float = 0.75):
        self.slope_threshold = slope_threshold
        self.upper = upper
        self.lower = lower
        self.interval_minutes = interval_minutes
        self.r2_threshold = r2_threshold

    def judge(self, data_list: list[MeasurementData]) -> dict:
        if len(data_list) < 2:
            return {"is_abnormal": False, "message": "", "predicted_time": None}

        # タイムスタンプで古→新にソート（呼び出し元の順序に依存しない）
        try:
            ordered = sorted(data_list, key=lambda d: _parse_ts(d.timestamp))
        except Exception:
            ordered = list(reversed(data_list))

        # 実時刻をx軸に使用（秒単位、最古を0基準）
        try:
            base_ts = _parse_ts(ordered[0].timestamp)
            x = np.array([
                (_parse_ts(d.timestamp) - base_ts).total_seconds()
                for d in ordered
            ])
        except Exception:
            # タイムスタンプが取得できない場合は均等ステップにフォールバック
            x = np.array(range(len(ordered)), dtype=float) * self.interval_minutes * 60

        y = np.array([d.value for d in ordered])

        coeffs = np.polyfit(x, y, 1)
        slope_per_sec, intercept = coeffs
        y_pred = np.polyval(coeffs, x)
        r2 = _r2(y, y_pred)

        # 傾きを「℃/ステップ」に換算（通知メッセージ用）
        slope_per_step = slope_per_sec * self.interval_minutes * 60

        if abs(slope_per_step) <= self.slope_threshold:
            return {"is_abnormal": False, "message": "", "predicted_steps": None}

        if r2 < self.r2_threshold:
            return {"is_abnormal": False, "message": "", "predicted_steps": None}

        current_value = y[-1]
        if slope_per_sec > 0:
            secs_to_threshold = (self.upper - current_value) / slope_per_sec
            direction = '上昇'
            limit = self.upper
        else:
            secs_to_threshold = (self.lower - current_value) / slope_per_sec
            direction = '下降'
            limit = self.lower

        minutes_to_threshold = secs_to_threshold / 60
        now_jst = datetime.now(JST)
        predicted_dt = now_jst + timedelta(seconds=secs_to_threshold)
        predicted_str = predicted_dt.strftime('%Y/%m/%d %H:%M')

        if minutes_to_threshold >= 60:
            time_label = f"約{minutes_to_threshold / 60:.1f}時間後"
        else:
            time_label = f"約{int(minutes_to_threshold)}分後"

        message = (
            f"温度が{direction}傾向です"
            f"（傾き：{slope_per_step:.2f}℃/ステップ，R²={r2:.2f}）．"
            f"{time_label}（{predicted_str}）に{limit}℃に達します"
        )

        steps_to_threshold = secs_to_threshold / (self.interval_minutes * 60)

        return {
            "is_abnormal": True,
            "message": message,
            "predicted_steps": round(float(steps_to_threshold), 1),
            "direction": "up" if slope_per_sec > 0 else "down",
            "limit_value": float(limit),
            "predicted_at": predicted_dt.astimezone(UTC),
            "r2": round(r2, 3),
        }
