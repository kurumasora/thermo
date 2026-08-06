from backend.judgement.base import BaseJudgement
from backend.interfaces import MeasurementData

JUDGEMENT_TYPE = "exponential_smoothing"
JUDGEMENT_LABEL = "指数平滑"
JUDGEMENT_PARAMS = [
    {"key": "alpha", "label": "平滑化係数 α (0=過去重視, 1=直近重視)", "type": "number", "default": 0.3, "step": 0.05, "min": 0, "max": 1},
    {"key": "margin", "label": "警告マージン (閾値からの距離)", "type": "number", "default": 5.0, "step": 0.5, "min": 0},
]


class ExponentialSmoothingJudgement(BaseJudgement):
    """
    指数平滑法による異常判定。
    直近の値に重みを置いた平滑値を計算し、閾値との距離で異常を判定する。
    alpha: 平滑化係数（0に近いほど過去重視、1に近いほど直近重視）
    margin: 閾値からこの値以内に入ったら警告
    """

    def __init__(self, upper: float, lower: float,
                 alpha: float = 0.3, margin: float = 5.0, **kwargs):
        self.upper = upper
        self.lower = lower
        self.alpha = alpha
        self.margin = margin

    def judge(self, data_list: list[MeasurementData]) -> dict:
        no_abnormal = {"is_abnormal": False, "message": "", "predicted_steps": None,
                       "direction": None, "limit_value": None, "predicted_at": None}

        if not data_list:
            return no_abnormal

        # 古い順に並べて指数平滑値を計算
        values = [d.value for d in reversed(data_list)]
        smoothed = values[0]
        for v in values[1:]:
            smoothed = self.alpha * v + (1 - self.alpha) * smoothed

        if smoothed >= self.upper - self.margin:
            return {
                "is_abnormal": True,
                "message": (
                    f"平滑値が上限に接近しています"
                    f"（平滑値：{smoothed:.2f}，上限：{self.upper}，マージン：{self.margin}，α={self.alpha}）"
                ),
                "predicted_steps": None,
                "direction": "up",
                "limit_value": float(self.upper),
                "predicted_at": None,
            }

        if smoothed <= self.lower + self.margin:
            return {
                "is_abnormal": True,
                "message": (
                    f"平滑値が下限に接近しています"
                    f"（平滑値：{smoothed:.2f}，下限：{self.lower}，マージン：{self.margin}，α={self.alpha}）"
                ),
                "predicted_steps": None,
                "direction": "down",
                "limit_value": float(self.lower),
                "predicted_at": None,
            }

        return no_abnormal


JUDGEMENT_CLASS = ExponentialSmoothingJudgement
