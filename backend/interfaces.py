from abc import ABC, abstructmethod

class MeasurementData:
    def __init__(self, channel: int, value: float, unit: str, timestamp: str):
        self.channel = channel
        self.value = value
        self.unit = unit
        self.timestamp = timestamp


#センサが変わってもメソッド名を変えなくてもいいようにする
class IMeasurementDevice(ABC):
    @abstructmethod
    def get_data(self) -> list[MeasurementData]:
        pass 