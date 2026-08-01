import random
from datetime import datetime
from backend.interfaces import IMeasurementDevice, MeasurementData


class DummyHumiditySensor(IMeasurementDevice):
    """テスト用仮想湿度センサ。ランダムウォークで湿度を生成する。"""

    def __init__(self):
        self._last_value = 60.0

    def get_data(self) -> list[MeasurementData]:
        # 前回値から±2%のランダムウォーク
        delta = random.uniform(-2.0, 2.0)
        self._last_value = max(10.0, min(95.0, self._last_value + delta))
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        return [
            MeasurementData(channel=1, value=round(self._last_value, 1), unit="%", timestamp=now),
        ]
