from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.db import get_connection
from backend.auth.utils import get_current_user, require_admin

router = APIRouter()


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
                   s.id AS sensor_id, s.name AS sensor_name, s.sensor_key
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


@router.put("/api/settings/{sensor_channel_id}")
def update_settings(sensor_channel_id: int, body: SettingsUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE channel_config
            SET upper_threshold = %s, lower_threshold = %s,
                slope_threshold = %s, regression_count = %s, trend_monitor = %s
            WHERE sensor_channel_id = %s
            """,
            (body.upper_threshold, body.lower_threshold,
             body.slope_threshold, body.regression_count, body.trend_monitor,
             sensor_channel_id)
        )
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
