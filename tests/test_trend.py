import pytest
from backend.interfaces import MeasurementData
from backend.judgement.factory import create_judgement


@pytest.fixture
def judgement():
    return create_judgement('linear', {'slope_threshold': 0.4}, upper=30.0, lower=20.0)


def make_series(values: list[float]) -> list[MeasurementData]:
    base = "2026-06-26 10:{:02d}:00"
    return [
        MeasurementData(channel=1, value=v, unit="℃", timestamp=base.format(i * 10))
        for i, v in enumerate(values)
    ]


def test_rising_trend_detected(judgement):
    data = make_series([24.0, 24.5, 25.0, 25.5, 26.0])
    result = judgement.judge(data)
    assert result["is_abnormal"]


def test_stable_no_alert(judgement):
    data = make_series([25.0, 25.1, 24.9, 25.0, 25.1])
    result = judgement.judge(data)
    assert not result["is_abnormal"]


def test_insufficient_data(judgement):
    data = make_series([25.0])
    result = judgement.judge(data)
    assert not result["is_abnormal"]
