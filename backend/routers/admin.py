from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from backend.db import get_connection
from backend.auth.utils import hash_password, require_admin

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

@router.get("/api/admin/users")
def get_users(user: dict = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, role, created_at FROM users ORDER BY created_at"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return[
        {
            "id": row[0],
            "username": row[1],
            "role": row[2],
            "created_at": str(row[3])
        }
        for row in rows
    ]

@router.post("/api/admin/users")
def create_user(body: UserCreate, user: dict = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM users WHERE username = %s",
        (body.username,)
    )
    if cur.fetchone() is not None:
        raise HTTPException(status_code = 400, detail="すでに存在するユーザ名です")

    cur.execute(
        "INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, %s)", 
        (body.username, hash_password(body.password), body.role)
    )
    conn.commit()
    cur.close()
    conn.close()
    return{"status": "ok"}

@router.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, user: dict = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM users WHERE id = %s",
        (user_id,)
    )
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="ユーザが存在しません")

    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "ok"}

class RoleUpdate(BaseModel):
    role: str

class PasswordReset(BaseModel):
    password: str

@router.put("/api/admin/users/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, user: dict = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET role = %s WHERE id = %s", (body.role, user_id))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "ok"}

@router.put("/api/admin/users/{user_id}/password")
def reset_password(user_id: int, body: PasswordReset, user: dict = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET hashed_password = %s WHERE id = %s",
        (hash_password(body.password), user_id)
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "ok"}