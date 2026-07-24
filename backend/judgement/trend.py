import numpy as np
from datetime import datetime, timedelta, timezone
from backend.interfaces import MeasurementData

JST = timezone(timedelta(hours=9))
UTC = timezone.utc

class TrendJudgement:
    def __init__(self, slope_threshold: float, upper: float, lower: float, interval_minutes: int = 10):
        self.slope_threshold = slope_threshold
        self.upper = upper
        self.lower = lower
        self.interval_minutes = interval_minutes

    def judge(self, data_list: list[MeasurementData]) -> dict:
        if len(data_list) < 2:
            return {"is_abnormal": False, "message": "", "predicted_time": None}

        x = np.array(range(len(data_list)))
        y = np.array([d.value for d in reversed(data_list)])
        slope, intercept = np.polyfit(x, y, 1)

        if abs(slope) > self.slope_threshold:
            current_value = y[-1]  # y は昇順（古→新）なので最後が最新値
            if slope > 0:
                steps_to_threshold = (self.upper - current_value) / slope
                direction = '上昇'
                limit = self.upper
            else:
                steps_to_threshold = (self.lower - current_value) / slope
                direction = '下降'
                limit = self.lower

            minutes_to_threshold = steps_to_threshold * self.interval_minutes
            now_jst = datetime.now(JST)
            predicted_dt = now_jst + timedelta(minutes=minutes_to_threshold)
            predicted_str = predicted_dt.strftime('%Y/%m/%d %H:%M')

            if minutes_to_threshold >= 60:
                time_label = f"約{minutes_to_threshold / 60:.1f}時間後"
            else:
                time_label = f"約{int(minutes_to_threshold)}分後"

            message = (
                f"温度が{direction}傾向です（傾き：{slope:.2f}℃/ステップ）．"
                f"{time_label}（{predicted_str}）に{limit}℃に達します"
            )

            return {
                "is_abnormal": True,
                "message": message,
                "predicted_steps": round(float(steps_to_threshold), 1),
                "direction": "up" if slope > 0 else "down",
                "limit_value": float(limit),
                "predicted_at": predicted_dt.astimezone(UTC),
            }
        return {"is_abnormal": False, "message": "", "predicted_steps": None}