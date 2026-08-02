import numpy as np
from datetime import datetime, timedelta, timezone
from backend.interfaces import MeasurementData
from backend.judgement.base import BaseJudgement

JST = timezone(timedelta(hours=9))
UTC = timezone.utc


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


class PolynomialJudgement(BaseJudgement):
    """
    2次多項式回帰による傾向判定。
    線形回帰では取れない加速的な変化（急激な温度上昇など）を検知する。
    """

    def __init__(self, slope_threshold: float, upper: float, lower: float,
                 interval_minutes: int = 10, r2_threshold: float = 0.75):
        self.slope_threshold = slope_threshold
        self.upper = upper
        self.lower = lower
        self.interval_minutes = interval_minutes
        self.r2_threshold = r2_threshold

    def judge(self, data_list: list[MeasurementData]) -> dict:
        no_abnormal = {"is_abnormal": False, "message": "", "predicted_steps": None,
                       "direction": None, "limit_value": None, "predicted_at": None}

        if len(data_list) < 3:
            return no_abnormal

        try:
            ordered = sorted(data_list, key=lambda d: _parse_ts(d.timestamp))
        except Exception:
            ordered = list(reversed(data_list))

        try:
            base_ts = _parse_ts(ordered[0].timestamp)
            x = np.array([
                (_parse_ts(d.timestamp) - base_ts).total_seconds()
                for d in ordered
            ])
        except Exception:
            x = np.array(range(len(ordered)), dtype=float) * self.interval_minutes * 60

        y = np.array([d.value for d in ordered])

        coeffs = np.polyfit(x, y, 2)
        a, b, c = coeffs
        y_pred = np.polyval(coeffs, x)
        r2 = _r2(y, y_pred)

        if r2 < self.r2_threshold:
            return no_abnormal

        # 現在時刻における1次微分（瞬間傾き）
        x_now = x[-1]
        slope_per_sec = 2 * a * x_now + b
        slope_per_step = slope_per_sec * self.interval_minutes * 60

        if abs(slope_per_step) <= self.slope_threshold:
            return no_abnormal

        current_value = y[-1]
        now_jst = datetime.now(JST)

        if slope_per_sec > 0:
            direction = '上昇'
            limit = self.upper
        else:
            direction = '下降'
            limit = self.lower

        # ax²+bx+c = limit を解いてx_nowより大きい根を探す
        roots = np.roots([a, b, c - limit])
        future_roots = [r.real for r in roots if np.isreal(r) and r.real > x_now]
        if future_roots:
            secs_to_threshold = max(min(future_roots) - x_now, 0)
        else:
            secs_to_threshold = 0

        predicted_dt = now_jst + timedelta(seconds=secs_to_threshold)
        predicted_str = predicted_dt.strftime('%Y/%m/%d %H:%M')
        minutes_to_threshold = secs_to_threshold / 60

        if secs_to_threshold == 0:
            time_label = "すでに閾値超過中"
        elif minutes_to_threshold >= 60:
            time_label = f"約{minutes_to_threshold / 60:.1f}時間後"
        else:
            time_label = f"約{int(minutes_to_threshold)}分後"

        if secs_to_threshold == 0:
            message = (
                f"温度が{direction}傾向です（2次回帰）"
                f"（瞬間傾き：{slope_per_step:.2f}℃/ステップ，R²={r2:.2f}）．"
                f"すでに{limit}℃の閾値を超過中です"
            )
        else:
            message = (
                f"温度が{direction}傾向です（2次回帰）"
                f"（瞬間傾き：{slope_per_step:.2f}℃/ステップ，R²={r2:.2f}）．"
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
