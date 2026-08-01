from fastapi import APIRouter, Depends, HTTPException
from backend.db import get_connection
from backend.auth.utils import get_current_user, require_admin

router = APIRouter()


@router.get("/api/sensors")
def get_sensors(user: dict = Depends(get_current_user)):
    """全センサとそのチャンネル定義を返す"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, sensor_key, name, active FROM sensors ORDER BY id")
        sensors = cur.fetchall()

        result = []
        for sensor_id, sensor_key, name, active in sensors:
            cur.execute(
                "SELECT id, channel_no, name, unit FROM sensor_channels WHERE sensor_id = %s ORDER BY channel_no",
                (sensor_id,)
            )
            channels = [
                {"id": r[0], "channel_no": r[1], "name": r[2], "unit": r[3]}
                for r in cur.fetchall()
            ]
            result.append({
                "id": sensor_id,
                "sensor_key": sensor_key,
                "name": name,
                "active": active,
                "channels": channels,
            })
        return result
    finally:
        conn.close()


@router.put("/api/admin/sensors/{sensor_id}/active")
def toggle_sensor_active(sensor_id: int, user: dict = Depends(require_admin)):
    """センサのアクティブ状態を切り替える（管理者のみ）"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE sensors SET active = NOT active WHERE id = %s RETURNING active",
            (sensor_id,)
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="センサが見つかりません")
        conn.commit()
        return {"active": row[0]}
    finally:
        conn.close()
