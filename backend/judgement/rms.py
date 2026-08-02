import numpy as np
from backend.interfaces import MeasurementData
from backend.judgement.base import BaseJudgement


class RMSJudgement(BaseJudgement):
    """
    振動センサ向けRMS（二乗平均平方根）判定。
    直近N件のRMS値を計算し、閾値を超えたら異常とみなす。
    傾向予測は行わず、瞬間的なエネルギー超過を検知する。
    """

    def __init__(self, upper: float, lower: float, rms_window: int = 10, **kwargs):
        self.upper = upper
        self.lower = lower
        self.rms_window = rms_window

    def judge(self, data_list: list[MeasurementData]) -> dict:
        no_abnormal = {"is_abnormal": False, "message": "", "predicted_steps": None,
                       "direction": None, "limit_value": None, "predicted_at": None}

        if not data_list:
            return no_abnormal

        window = data_list[-self.rms_window:]
        values = np.array([d.value for d in window])
        rms = float(np.sqrt(np.mean(values ** 2)))

        if rms > self.upper:
            message = (
                f"振動RMSが上限を超過しました"
                f"（RMS={rms:.3f}，上限={self.upper}，N={len(window)}件）"
            )
            return {
                "is_abnormal": True,
                "message": message,
                "predicted_steps": None,
                "direction": "up",
                "limit_value": float(self.upper),
                "predicted_at": None,
                "r2": None,
            }

        if rms < self.lower:
            message = (
                f"振動RMSが下限を下回りました"
                f"（RMS={rms:.3f}，下限={self.lower}，N={len(window)}件）"
            )
            return {
                "is_abnormal": True,
                "message": message,
                "predicted_steps": None,
                "direction": "down",
                "limit_value": float(self.lower),
                "predicted_at": None,
                "r2": None,
            }

        return no_abnormal
