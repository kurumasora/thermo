from fastapi import APIRouter, Depends
from backend.db import get_connection
from backend.auth.utils import get_current_user

router = APIRouter()

@router.get("/api/measurements")
def get_measurements(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, timestamp, temp_ch1, temp_ch2, battery_level FROM measurements ORDER BY timestamp DESC LIMIT 100"
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {
                "id": row[0],
                "timestamp": str(row[1]),
                "temp_ch1": row[2],
                "temp_ch2": row[3],
                "battery_level": row[4]
            }
            for row in rows
        ]
    finally:
        conn.close()

@router.get("/api/alerts")
def get_alerts(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, timestamp, channel, alert_type, value, message, predicted_steps FROM alert_history ORDER BY timestamp DESC LIMIT 100"
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {
                "id": row[0],
                "timestamp": str(row[1]),
                "channel": row[2],
                "alert_type": row[3],
                "value": row[4],
                "message": row[5],
                "predicted_steps": row[6]
            }
            for row in rows
        ]
    finally:
        conn.close()
