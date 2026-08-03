class MeasurementData:
    def __init__(self, channel: int, value: float, unit: str, timestamp: str):
        self.channel = channel
        self.value = value
        self.unit = unit
        self.timestamp = timestamp
