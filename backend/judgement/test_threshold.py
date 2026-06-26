from backend.interfaces import MeasurementData
from backend.judgement.threshold import ThresholdJudgement

judgement = ThresholdJudgement(upper = 30.0, lower = 20.0)

# 正常値のテスト
data_normal = MeasurementData(channel=1, value=25.0, unit="℃", timestamp="2026-06-26 10:00:00")
print(judgement.judge(data_normal))

# 上限超えのテスト
data_upper = MeasurementData(channel=1, value=31.0, unit="℃", timestamp="2026-06-26 10:00:00")
print(judgement.judge(data_upper))

# 下限超えのテスト
data_lower = MeasurementData(channel=1, value=19.0, unit="℃", timestamp="2026-06-26 10:00:00")
print(judgement.judge(data_lower))