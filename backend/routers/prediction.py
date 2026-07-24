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
            SELECT
                tp.id, tp.channel, tp.direction, tp.limit_value,
                tp.predicted_at, tp.created_at, tp.verified,
                tp.verified_at, tp.outcome,
                ah.message AS alert_message
            FROM trend_predictions tp
            LEFT JOIN alert_history ah ON ah.id = tp.alert_history_id
            ORDER BY tp.created_at DESC
            LIMIT 50
            """
        )
        rows = cur.fetchall()
        records = [
            {
                "id": r[0],
                "channel": r[1],
                "direction": r[2],
                "limit_value": r[3],
                "predicted_at": str(r[4]),
                "created_at": str(r[5]),
                "verified": r[6],
                "verified_at": str(r[7]) if r[7] else None,
                "outcome": r[8],
                "alert_message": r[9],
            }
            for r in rows
        ]

        return {
            "summary": {
                "total": total,
                "verified": verified,
                "hits": hits,
                "misses": misses,
                "pending": pending,
                "accuracy_pct": accuracy,
            },
            "records": records,
        }
    finally:
        conn.close()
