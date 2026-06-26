import numpy as np
from backend.interfaces import MeasurementData

class TrendJudgement:
    def __init__(self, slope_threshold: float, upper: float, lower: float):
        self.slope_threshold = slope_threshold
        self.upper = upper
        self.lower = lower

    def judge(self, data_list: list[MeasurementData]) -> dict:
        if len(data_list) < 2:
            return {"is_abnormal": False, "message": "", "predicted_time": none}
        
        x = np.array(range(len(data_list)))
        y = np.array([d.value for d in data_list])
        slope, intercept = np.polyfit(x, y, 1)

        if abs(slope) > self.slope_threshold:
            current_value = y[-1]
            if slope > 0:
                steps_to_threshold = (self.upper - current_value) / slope
                direction = '上昇'
                limit = self.upper
            else:
                steps_to_threshold = (self.upper - current_value) / slope
                direction = '下降'
                limit = self.lower
            
            return {
                "is_abnormal": True,
                "message": f"温度が{direction}傾向です（傾き：{slope:.2f}℃/ステップ）．約{steps_to_threshold:.1f}ステップ後に{limit}℃に到達予測",
                "predicted_steps": round(float(steps_to_threshold), 1)
            }
        return {"is_abnormal": False, "message": "", "predicted_steps":None}