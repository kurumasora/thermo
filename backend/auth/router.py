from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from backend.db import get_connection
from backend.auth.utils import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/api/auth/login")
def login(body: LoginRequest):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, hashed_password, role FROM users WHERE username = %s",
        (body.username,)
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user is None or not verify_password(body.password, user[2]):
        raise HTTPException(status_code=401, detail="ユーザ名またはパスワードが違います")

    token = create_access_token({"sub": user[1], "role": user[3]})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/api/auth/logout")
def logout():
    return {"status": "ok"}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.put("/api/auth/password")
def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT hashed_password FROM users WHERE username = %s",
            (user["sub"],)
        )
        row = cur.fetchone()
        if row is None or not verify_password(body.current_password, row[0]):
            raise HTTPException(status_code=400, detail="現在のパスワードが違います")
        cur.execute(
            "UPDATE users SET hashed_password = %s WHERE username = %s",
            (hash_password(body.new_password), user["sub"])
        )
        conn.commit()
        cur.close()
        return {"status": "ok"}
    finally:
        conn.close()