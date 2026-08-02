from backend.judgement.base import BaseJudgement
from backend.judgement.trend import TrendJudgement
from backend.judgement.polynomial import PolynomialJudgement
from backend.judgement.rms import RMSJudgement


def create_judgement(judgement_type: str, params: dict, upper: float, lower: float) -> BaseJudgement:
    """
    judgement_typeとparamsから判定クラスを生成して返す。
    新しい判定クラスを追加する場合はここに追記する。
    """
    if judgement_type == 'linear':
        return TrendJudgement(
            slope_threshold=params.get('slope_threshold', 1.0),
            upper=upper,
            lower=lower,
            interval_minutes=10,
            r2_threshold=params.get('r2_threshold', 0.75),
        )

    if judgement_type == 'polynomial':
        return PolynomialJudgement(
            slope_threshold=params.get('slope_threshold', 1.0),
            upper=upper,
            lower=lower,
            interval_minutes=10,
            r2_threshold=params.get('r2_threshold', 0.75),
        )

    if judgement_type == 'rms':
        return RMSJudgement(
            upper=upper,
            lower=lower,
            rms_window=int(params.get('rms_window', 10)),
        )

    raise ValueError(f"未対応の judgement_type: {judgement_type}")
