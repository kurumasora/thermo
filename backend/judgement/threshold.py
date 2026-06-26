from backend.interfaces import MeasurementData

class ThresholdJudgement:
    def __init__(self, upper: float, lower: float):
        self.upper = upper
        self.lower = lower

    def judge(self, data: MeasurementData) -> dict:
        if data.value > self.upper:
            return {
                "is_abnormal":True,
                "message": f"CH{data.channel}が上限閾値{self.upper}{data.unit}を超えました（現在値：{data.value}{data.unit}"
        
            }
        elif data.value < self.lower:
            return{
                "is_abnormal":True,
                "message": f"CH{data.channel}が下限閾値{self.lower}{data.unit}を下回りました（現在値：{data.value}{data.unit}"

            }
        else:
            return{
                "is_abnormal": False,
                "message": ""
            }


    