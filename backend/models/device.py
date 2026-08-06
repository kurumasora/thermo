from abc import ABC, abstractmethod
from backend.models.measurement import MeasurementData


class IMeasurementDevice(ABC):
    @abstractmethod
    def get_data(self) -> list[MeasurementData]:
        pass
