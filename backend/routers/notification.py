from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.db import get_connection
from backend.auth.utils import require_admin

router = APIRouter()


# --- SMTP設定 ---

class SmtpConfigUpdate(BaseModel):
    host: str
    port: int = 587
    username: str
    password: Optional[str] = None  # Noneの場合は変更しない
    from_address: str


@router.get("/api/admin/smtp-config")
def get_smtp_config(user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT host, port, username, from_address FROM smtp_config WHERE id = 1")
        row = cur.fetchone()
        if not row:
            return {"host": None, "port": 587, "username": None, "from_address": None, "password_set": False}
        return {
            "host": row[0],
            "port": row[1],
            "username": row[2],
            "from_address": row[3],
            "password_set": row[2] is not None,  # パスワード自体は返さない
        }
    finally:
        conn.close()


@router.put("/api/admin/smtp-config")
def update_smtp_config(body: SmtpConfigUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        if body.password is not None:
            cur.execute("""
                UPDATE smtp_config SET host=%s, port=%s, username=%s, password=%s, from_address=%s
                WHERE id = 1
            """, (body.host, body.port, body.username, body.password, body.from_address))
        else:
            cur.execute("""
                UPDATE smtp_config SET host=%s, port=%s, username=%s, from_address=%s
                WHERE id = 1
            """, (body.host, body.port, body.username, body.from_address))
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()


# --- センサ通知設定 ---

class SensorNotificationUpdate(BaseModel):
    webhook_enabled: bool
    email_enabled: bool


@router.put("/api/admin/sensors/{sensor_id}/notification")
def update_sensor_notification(sensor_id: int, body: SensorNotificationUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE sensors SET webhook_enabled=%s, email_enabled=%s WHERE id=%s RETURNING id",
            (body.webhook_enabled, body.email_enabled, sensor_id)
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="センサが見つかりません")
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()


# --- メール通知先 ---

class EmailRecipientAdd(BaseModel):
    email: str


@router.get("/api/admin/sensors/{sensor_id}/email-recipients")
def get_email_recipients(sensor_id: int, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email FROM sensor_email_recipients WHERE sensor_id=%s ORDER BY id", (sensor_id,))
        return [{"id": r[0], "email": r[1]} for r in cur.fetchall()]
    finally:
        conn.close()


@router.post("/api/admin/sensors/{sensor_id}/email-recipients")
def add_email_recipient(sensor_id: int, body: EmailRecipientAdd, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO sensor_email_recipients (sensor_id, email) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING id",
            (sensor_id, body.email)
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail="このメールアドレスはすでに登録されています")
        conn.commit()
        return {"status": "ok", "id": row[0]}
    finally:
        conn.close()


@router.delete("/api/admin/email-recipients/{recipient_id}")
def delete_email_recipient(recipient_id: int, user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM sensor_email_recipients WHERE id=%s RETURNING id", (recipient_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="見つかりません")
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
