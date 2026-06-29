from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.db import get_connection
from backend.auth.utils import verify_password, create_access_token

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