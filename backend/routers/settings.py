from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.db import get_connection
from backend.auth.utils import get_current_user, require_admin

router = APIRouter()

class SettingsUpdate(BaseModel):
    upper_threshold: float
    lower_threshold: float
    slope_threshold: float
    regression_count: int
    trend_monitor: bool

@router.get("/api/settings")
def get_settings(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, channel, upper_threshold, lower_threshold, slope_threshold, regression_count, trend_monitor FROM master_config ORDER BY channel"
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {
                "id": row[0],
                "channel": row[1],
                "upper_threshold": row[2],
                "lower_threshold": row[3],
                "slope_threshold": row[4],
                "regression_count": row[5],
                "trend_monitor": row[6]
            }
            for row in rows
        ]
    finally:
        conn.close()

@router.put("/api/settings/{channel}")
def update_settings(channel: int, body: SettingsUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE master_config SET upper_threshold = %s, lower_threshold = %s, slope_threshold = %s, regression_count = %s, trend_monitor = %s WHERE channel = %s",
            (body.upper_threshold, body.lower_threshold, body.slope_threshold, body.regression_count, body.trend_monitor, channel)
        )
        conn.commit()
        cur.close()
        return {"status": "ok"}
    finally:
        conn.close()
