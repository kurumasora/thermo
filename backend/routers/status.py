from fastapi import APIRouter, Depends
from backend.db import get_connection
from backend.auth.utils import get_current_user

router = APIRouter()


@router.get("/api/measurements")
def get_measurements(user: dict = Depends(get_current_user)):
    """全アクティブセンサの直近100件（チャンネルごと）を返す"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT m.id, m.timestamp, m.sensor_channel_id, m.value
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
            ORDER BY m.timestamp DESC
            LIMIT 500
            """
        )
        rows = cur.fetchall()
        return [
            {"id": r[0], "timestamp": str(r[1]), "sensor_channel_id": r[2], "value": r[3]}
            for r in rows
        ]
    finally:
        conn.close()


@router.get("/api/measurements/latest")
def get_latest(user: dict = Depends(get_current_user)):
    """チャンネルごとの最新値を返す {sensor_channel_id: value}"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT ON (m.sensor_channel_id)
                m.sensor_channel_id, m.value, m.timestamp
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
            ORDER BY m.sensor_channel_id, m.timestamp DESC
            """
        )
        rows = cur.fetchall()
        return {str(r[0]): {"value": r[1], "timestamp": str(r[2])} for r in rows}
    finally:
        conn.close()


@router.get("/api/alerts")
def get_alerts(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ah.id, ah.timestamp, ah.sensor_channel_id,
                   sc.name AS channel_name, sc.unit,
                   s.name AS sensor_name,
                   ah.alert_type, ah.value, ah.message, ah.predicted_steps
            FROM alert_history ah
            JOIN sensor_channels sc ON sc.id = ah.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            ORDER BY ah.timestamp DESC
            LIMIT 200
            """
        )
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "timestamp": str(r[1]),
                "sensor_channel_id": r[2],
                "channel_name": r[3],
                "unit": r[4],
                "sensor_name": r[5],
                "alert_type": r[6],
                "value": r[7],
                "message": r[8],
                "predicted_steps": r[9],
            }
            for r in rows
        ]
    finally:
        conn.close()
