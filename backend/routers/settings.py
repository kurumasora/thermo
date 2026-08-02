import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from backend.db import get_connection
from backend.auth.utils import get_current_user, require_admin
from backend.judgement.factory import get_judgement_types

router = APIRouter()


@router.get("/api/judgement-types")
def list_judgement_types(user: dict = Depends(get_current_user)):
    return get_judgement_types()


@router.get("/api/settings")
def get_settings(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT cc.sensor_channel_id, cc.upper_threshold, cc.lower_threshold,
                   cc.trend_monitor,
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
                "trend_monitor": r[3],
                "channel_no": r[4],
                "channel_name": r[5],
                "unit": r[6],
                "sensor_id": r[7],
                "sensor_name": r[8],
                "sensor_key": r[9],
                "judgement_type": r[10] or "linear",
                "judgement_params": r[11] or {},
            }
            for r in rows
        ]
    finally:
        conn.close()


class SettingsUpdate(BaseModel):
    upper_threshold: float
    lower_threshold: float
    trend_monitor: bool
    judgement_type: str = "linear"
    judgement_params: Optional[dict] = None


@router.put("/api/settings/{sensor_channel_id}")
def update_settings(sensor_channel_id: int, body: SettingsUpdate, user: dict = Depends(require_admin)):
    params = body.judgement_params or {}
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE channel_config
            SET upper_threshold = %s, lower_threshold = %s,
                trend_monitor = %s, judgement_type = %s, judgement_params = %s
            WHERE sensor_channel_id = %s
            """,
            (body.upper_threshold, body.lower_threshold,
             body.trend_monitor, body.judgement_type, json.dumps(params),
             sensor_channel_id)
        )
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
