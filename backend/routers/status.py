from fastapi import APIRouter
from backend.db import get_connection

router = APIRouter()

@router.get("/api/measurements")
def get_measurements():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, timestamp, temp_ch1, temp_ch2, battery_level FROM measurements ORDER BY timestamp DESC LIMIT 100"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
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

@router.get("/api/alerts")
def get_alerts():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, timestamp, channl, alert_type, value, message, FROM alert_history ORDER BY timestamp DESC LIMIT 100"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "id": row[0], 
            "timestamp": str(row[1]), 
            "channel": rows[2], 
            "alert_type": row[3], 
            "value": row[4], 
            "message": row[5]
        }
        for row in rows
    ]