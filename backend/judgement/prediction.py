from datetime import datetime, timezone
from backend.db import get_connection


def is_prediction_tracking_enabled() -> bool:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT value FROM system_settings WHERE key = 'prediction_tracking'")
        row = cur.fetchone()
        return row is not None and row[0] == 'true'
    finally:
        conn.close()


def save_prediction(alert_history_id: int, sensor_channel_id: int, direction: str,
                    limit_value: float, predicted_at: datetime) -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO trend_predictions
                (alert_history_id, sensor_channel_id, direction, limit_value, predicted_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (alert_history_id, sensor_channel_id, direction, limit_value, predicted_at)
        )
        conn.commit()
    finally:
        conn.close()


def verify_past_predictions() -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        now = datetime.now(timezone.utc)

        cur.execute(
            """
            SELECT id, sensor_channel_id, direction, limit_value, predicted_at
            FROM trend_predictions
            WHERE verified = FALSE AND predicted_at <= %s
            """,
            (now,)
        )
        pending = cur.fetchall()

        for pred_id, sensor_channel_id, direction, limit_value, predicted_at in pending:
            cur.execute(
                """
                SELECT value FROM measurements
                WHERE sensor_channel_id = %s
                  AND timestamp BETWEEN %s - INTERVAL '10 minutes'
                                    AND %s + INTERVAL '10 minutes'
                ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - %s)))
                LIMIT 1
                """,
                (sensor_channel_id, predicted_at, predicted_at, predicted_at)
            )
            row = cur.fetchone()

            if row is None:
                outcome = 'miss'
            else:
                actual = row[0]
                if direction == 'up':
                    outcome = 'hit' if actual >= limit_value else 'miss'
                else:
                    outcome = 'hit' if actual <= limit_value else 'miss'

            cur.execute(
                "UPDATE trend_predictions SET verified = TRUE, verified_at = %s, outcome = %s WHERE id = %s",
                (now, outcome, pred_id)
            )

        conn.commit()
    finally:
        conn.close()
