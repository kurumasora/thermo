from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from backend.db import get_connection
from backend.auth.utils import get_current_user, require_admin
from backend.judgement.factory import create_judgement

router = APIRouter()

# 判定タイプ一覧（UIのセレクトボックス用）
JUDGEMENT_TYPES = [
    {"value": "linear", "label": "線形回帰"},
]


@router.get("/api/judgement-types")
def get_judgement_types(user: dict = Depends(get_current_user)):
    return JUDGEMENT_TYPES


@router.get("/api/settings")
def get_settings(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT cc.sensor_channel_id, cc.upper_threshold, cc.lower_threshold,
                   cc.slope_threshold, cc.regression_count, cc.trend_monitor,
                   sc.channel_no, sc.name AS channel_name, sc.unit,
                   s.id AS sensor_id, s.name AS sensor_name, s.sensor_key,
                   cc.judgement_type, cc.judgement_params
            FROM channel_config cc
            JOIN sensor_channels sc ON sc.id = cc.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            ORDER BY s.id, sc.channel_no
            """
        )
        rows = cur.fetchall()
        return [
            {
                "sensor_channel_id": r[0],
                "upper_threshold": r[1],
                "lower_threshold": r[2],
                "slope_threshold": r[3],
                "regression_count": r[4],
                "trend_monitor": r[5],
                "channel_no": r[6],
                "channel_name": r[7],
                "unit": r[8],
                "sensor_id": r[9],
                "sensor_name": r[10],
                "sensor_key": r[11],
                "judgement_type": r[12] or "linear",
                "judgement_params": r[13] or {},
            }
            for r in rows
        ]
    finally:
        conn.close()


class SettingsUpdate(BaseModel):
    upper_threshold: float
    lower_threshold: float
    slope_threshold: float
    regression_count: int
    trend_monitor: bool
    judgement_type: str = "linear"
    judgement_params: Optional[dict] = None


@router.put("/api/settings/{sensor_channel_id}")
def update_settings(sensor_channel_id: int, body: SettingsUpdate, user: dict = Depends(require_admin)):
    # judgement_paramsをjudgement_typeに合わせて構築
    if body.judgement_type == "linear":
        params = {
            "slope_threshold": body.slope_threshold,
            "regression_count": body.regression_count,
            "r2_threshold": (body.judgement_params or {}).get("r2_threshold", 0.75),
        }
    else:
        params = body.judgement_params or {}

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE channel_config
            SET upper_threshold = %s, lower_threshold = %s,
                slope_threshold = %s, regression_count = %s, trend_monitor = %s,
                judgement_type = %s, judgement_params = %s
            WHERE sensor_channel_id = %s
            """,
            (body.upper_threshold, body.lower_threshold,
             body.slope_threshold, body.regression_count, body.trend_monitor,
             body.judgement_type, params,
             sensor_channel_id)
        )
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
