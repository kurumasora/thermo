import pytest
from backend.interfaces import MeasurementData
from backend.judgement.threshold import ThresholdJudgement


@pytest.fixture
def judgement():
    return ThresholdJudgement(upper=30.0, lower=20.0)


def make(value: float) -> MeasurementData:
    return MeasurementData(channel=1, value=value, unit="℃", timestamp="2026-06-26 10:00:00")


def test_normal(judgement):
    result = judgement.judge(make(25.0))
    assert not result["is_abnormal"]


def test_upper_exceeded(judgement):
    result = judgement.judge(make(31.0))
    assert result["is_abnormal"]
    assert "上限" in result["message"]


def test_lower_exceeded(judgement):
    result = judgement.judge(make(19.0))
    assert result["is_abnormal"]
    assert "下限" in result["message"]


def test_exactly_on_upper(judgement):
    result = judgement.judge(make(30.0))
    assert not result["is_abnormal"]


def test_exactly_on_lower(judgement):
    result = judgement.judge(make(20.0))
    assert not result["is_abnormal"]
