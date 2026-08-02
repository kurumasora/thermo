import importlib
import pkgutil
import logging
from backend.judgement.base import BaseJudgement

logger = logging.getLogger(__name__)


def _load_plugins() -> tuple[dict, dict, dict]:
    """backend/plugins/ 以下の .py ファイルを自動スキャンして判定クラスを登録する。"""
    import backend.judgement.plugins as plugins_pkg
    registry: dict[str, type[BaseJudgement]] = {}
    labels: dict[str, str] = {}
    params: dict[str, list] = {}

    for finder, module_name, _ in pkgutil.iter_modules(plugins_pkg.__path__):
        full_name = f"backend.judgement.plugins.{module_name}"
        try:
            mod = importlib.import_module(full_name)
        except Exception as e:
            logger.warning(f"プラグイン読み込みエラー ({full_name}): {e}")
            continue

        judgement_type = getattr(mod, "JUDGEMENT_TYPE", None)
        judgement_label = getattr(mod, "JUDGEMENT_LABEL", judgement_type)
        judgement_class = getattr(mod, "JUDGEMENT_CLASS", None)
        judgement_params = getattr(mod, "JUDGEMENT_PARAMS", [])

        if not judgement_type or not judgement_class:
            logger.warning(f"プラグイン ({full_name}): JUDGEMENT_TYPE または JUDGEMENT_CLASS が未定義のためスキップ")
            continue

        if not issubclass(judgement_class, BaseJudgement):
            logger.warning(f"プラグイン ({full_name}): JUDGEMENT_CLASS が BaseJudgement を継承していないためスキップ")
            continue

        registry[judgement_type] = judgement_class
        labels[judgement_type] = judgement_label
        params[judgement_type] = judgement_params
        logger.info(f"プラグイン登録: {judgement_type} ({full_name})")

    return registry, labels, params


# モジュールロード時に一度だけプラグインをスキャン
_REGISTRY, _LABELS, _PARAMS = _load_plugins()


def get_judgement_types() -> list[dict]:
    """UIのセレクトボックス用に判定タイプ一覧（パラメータ定義込み）を返す。"""
    return [
        {"value": k, "label": _LABELS[k], "params": _PARAMS.get(k, [])}
        for k in _LABELS
    ]


def create_judgement(judgement_type: str, params: dict, upper: float, lower: float) -> BaseJudgement:
    """judgement_typeとparamsから判定クラスを生成して返す。"""
    cls = _REGISTRY.get(judgement_type)
    if cls is None:
        raise ValueError(f"未対応の judgement_type: {judgement_type}")
    return cls(upper=upper, lower=lower, **{k: v for k, v in params.items()})
