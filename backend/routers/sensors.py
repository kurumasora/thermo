from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.db import get_connection
from backend.auth.utils import get_current_user, require_admin
from backend.devices.sensor_map import SENSOR_MAP

router = APIRouter()


@router.get("/api/sensors")
def get_sensors(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, sensor_key, name, active, webhook_url, webhook_enabled, email_enabled FROM sensors ORDER BY id")
        sensors = cur.fetchall()

        result = []
        for sensor_id, sensor_key, name, active, webhook_url, webhook_enabled, email_enabled in sensors:
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
                "webhook_url": webhook_url,
                "webhook_enabled": webhook_enabled,
                "email_enabled": email_enabled,
                "channels": channels,
                "in_sensor_map": sensor_key in SENSOR_MAP,
            })
        return result
    finally:
        conn.close()


@router.get("/api/admin/sensor-map-keys")
def get_sensor_map_keys(user: dict = Depends(require_admin)):
    """SENSOR_MAPに登録済みのキー一覧を返す（UI上でのセンサキー候補）"""
    return {"keys": list(SENSOR_MAP.keys())}


@router.put("/api/admin/sensors/{sensor_id}/active")
def toggle_sensor_active(sensor_id: int, user: dict = Depends(require_admin)):
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


class WebhookUrlUpdate(BaseModel):
    webhook_url: Optional[str] = None


@router.put("/api/admin/sensors/{sensor_id}/webhook")
def update_sensor_webhook(sensor_id: int, body: WebhookUrlUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE sensors SET webhook_url = %s WHERE id = %s RETURNING id",
            (body.webhook_url or None, sensor_id)
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="センサが見つかりません")
        conn.commit()
        return {"status": "ok", "webhook_url": body.webhook_url or None}
    finally:
        conn.close()


class ChannelInput(BaseModel):
    channel_no: int
    name: str
    unit: str
    upper_threshold: float
    lower_threshold: float
    trend_monitor: bool = False


class SensorCreate(BaseModel):
    sensor_key: str
    name: str
    channels: List[ChannelInput]


@router.post("/api/admin/sensors")
def create_sensor(body: SensorCreate, user: dict = Depends(require_admin)):
    if body.sensor_key not in SENSOR_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"sensor_key '{body.sensor_key}' はSENSOR_MAPに登録されていません。プログラマに依頼してください。"
        )

    conn = get_connection()
    try:
        cur = conn.cursor()

        # sensor_key重複チェック
        cur.execute("SELECT id FROM sensors WHERE sensor_key = %s", (body.sensor_key,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="このsensor_keyはすでに登録されています")

        # センサ登録
        cur.execute(
            "INSERT INTO sensors (sensor_key, name, active) VALUES (%s, %s, FALSE) RETURNING id",
            (body.sensor_key, body.name)
        )
        sensor_id = cur.fetchone()[0]

        # チャンネル登録
        for ch in body.channels:
            cur.execute(
                "INSERT INTO sensor_channels (sensor_id, channel_no, name, unit) VALUES (%s, %s, %s, %s) RETURNING id",
                (sensor_id, ch.channel_no, ch.name, ch.unit)
            )
            channel_id = cur.fetchone()[0]
            cur.execute(
                """INSERT INTO channel_config
                   (sensor_channel_id, upper_threshold, lower_threshold, trend_monitor)
                   VALUES (%s, %s, %s, %s)""",
                (channel_id, ch.upper_threshold, ch.lower_threshold, ch.trend_monitor)
            )

        conn.commit()
        return {"status": "ok", "sensor_id": sensor_id}
    finally:
        conn.close()


@router.delete("/api/admin/sensors/{sensor_id}")
def delete_sensor(sensor_id: int, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sensors WHERE id = %s", (sensor_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="センサが見つかりません")

        # 関連データを削除（channel_config → sensor_channels → sensors の順）
        cur.execute("""
            DELETE FROM channel_config
            WHERE sensor_channel_id IN (
                SELECT id FROM sensor_channels WHERE sensor_id = %s
            )
        """, (sensor_id,))
        cur.execute("DELETE FROM sensor_channels WHERE sensor_id = %s", (sensor_id,))
        cur.execute("DELETE FROM sensors WHERE id = %s", (sensor_id,))
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
