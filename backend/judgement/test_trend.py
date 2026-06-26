from backend.interfaces import MeasurementData
from backend.judgement.trend import TrendJudgement

judgement = TrendJudgement(slope_threshold = 0.4, upper = 30.0, lower = 20.0)

# 上昇傾向のテスト
data_rising = [
    MeasurementData(channel=1, value=24.0, unit="℃", timestamp="2026-06-26 10:00:00"),
    MeasurementData(channel=1, value=24.5, unit="℃", timestamp="2026-06-26 10:10:00"),
    MeasurementData(channel=1, value=25.0, unit="℃", timestamp="2026-06-26 10:20:00"),
    MeasurementData(channel=1, value=25.5, unit="℃", timestamp="2026-06-26 10:30:00"),
    MeasurementData(channel=1, value=26.0, unit="℃", timestamp="2026-06-26 10:40:00"),
]
print(judgement.judge(data_rising))

# 正常のテスト
data_normal = [
    MeasurementData(channel=1, value=25.0, unit="℃", timestamp="2026-06-26 10:00:00"),
    MeasurementData(channel=1, value=25.1, unit="℃", timestamp="2026-06-26 10:10:00"),
    MeasurementData(channel=1, value=24.9, unit="℃", timestamp="2026-06-26 10:20:00"),
    MeasurementData(channel=1, value=25.0, unit="℃", timestamp="2026-06-26 10:30:00"),
    MeasurementData(channel=1, value=25.1, unit="℃", timestamp="2026-06-26 10:40:00"),
]
print(judgement.judge(data_normal))