from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.db import get_connection
from backend.auth.utils import require_admin

router = APIRouter()


@router.get("/api/admin/prediction/settings")
def get_prediction_settings(user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT value FROM system_settings WHERE key = 'prediction_tracking'")
        row = cur.fetchone()
        return {"enabled": row is not None and row[0] == 'true'}
    finally:
        conn.close()


class PredictionSettingsUpdate(BaseModel):
    enabled: bool


@router.put("/api/admin/prediction/settings")
def update_prediction_settings(body: PredictionSettingsUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE system_settings SET value = %s WHERE key = 'prediction_tracking'",
            ('true' if body.enabled else 'false',)
        )
        conn.commit()
        return {"status": "ok", "enabled": body.enabled}
    finally:
        conn.close()


@router.get("/api/admin/prediction/report")
def get_prediction_report(user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE verified) AS verified_count,
                COUNT(*) FILTER (WHERE outcome = 'hit') AS hit_count,
                COUNT(*) FILTER (WHERE outcome = 'miss') AS miss_count,
                COUNT(*) FILTER (WHERE NOT verified) AS pending_count,
                COUNT(*) AS total_count
            FROM trend_predictions
            """
        )
        stats = cur.fetchone()
        verified, hits, misses, pending, total = stats
        accuracy = round(hits / verified * 100, 1) if verified > 0 else None

        cur.execute(
            """
            SELECT tp.id, sc.name AS channel_name, s.name AS sensor_name,
                   tp.direction, tp.limit_value, tp.predicted_at, tp.created_at,
                   tp.verified, tp.verified_at, tp.outcome, ah.message
            FROM trend_predictions tp
            LEFT JOIN alert_history ah ON ah.id = tp.alert_history_id
            JOIN sensor_channels sc ON sc.id = tp.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            ORDER BY tp.created_at DESC
            LIMIT 50
            """
        )
        rows = cur.fetchall()
        records = [
            {
                "id": r[0],
                "channel_name": r[1],
                "sensor_name": r[2],
                "direction": r[3],
                "limit_value": r[4],
                "predicted_at": str(r[5]),
                "created_at": str(r[6]),
                "verified": r[7],
                "verified_at": str(r[8]) if r[8] else None,
                "outcome": r[9],
                "alert_message": r[10],
            }
            for r in rows
        ]

        return {
            "summary": {
                "total": total, "verified": verified, "hits": hits,
                "misses": misses, "pending": pending, "accuracy_pct": accuracy,
            },
            "records": records,
        }
    finally:
        conn.close()
