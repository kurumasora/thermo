from abc import ABC, abstractmethod
from backend.interfaces import MeasurementData


class BaseJudgement(ABC):
    @abstractmethod
    def judge(self, data_list: list[MeasurementData]) -> dict:
        """
        異常判定を行い結果を返す。

        戻り値は必ず以下のキーを含むdict:
          - is_abnormal: bool
          - message: str
          - predicted_steps: int | None
          - direction: str | None  ('up' or 'down')
          - limit_value: float | None
          - predicted_at: str | None
        """
        ...
