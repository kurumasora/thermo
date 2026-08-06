"""認証・権限テスト"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from backend.main import app
from backend.auth.utils import hash_password, create_access_token

client = TestClient(app)


def mock_conn_with_user(user_row):
    """指定ユーザー行を返すモックDBコネクション"""
    cur = MagicMock()
    cur.fetchone.return_value = user_row
    cur.fetchall.return_value = []
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn


# ─── ログイン ─────────────────────────────────────────────────────────────────

class TestLogin:
    def test_success(self):
        hashed = hash_password("correct")
        user_row = (1, "admin", hashed, "admin")
        with patch("backend.auth.router.get_connection", return_value=mock_conn_with_user(user_row)):
            res = client.post("/api/auth/login", json={"username": "admin", "password": "correct"})
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_wrong_password(self):
        hashed = hash_password("correct")
        user_row = (1, "admin", hashed, "admin")
        with patch("backend.auth.router.get_connection", return_value=mock_conn_with_user(user_row)):
            res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert res.status_code == 401

    def test_user_not_found(self):
        with patch("backend.auth.router.get_connection", return_value=mock_conn_with_user(None)):
            res = client.post("/api/auth/login", json={"username": "nobody", "password": "pass"})
        assert res.status_code == 401


# ─── 保護エンドポイント ────────────────────────────────────────────────────────

class TestProtectedEndpoints:
    def test_no_token_returns_401(self):
        res = client.get("/api/sensors")
        assert res.status_code == 401

    def test_invalid_token_returns_401(self):
        res = client.get("/api/sensors", headers={"Authorization": "Bearer invalid.token.here"})
        assert res.status_code == 401

    def test_user_cannot_access_admin_endpoint(self):
        token = create_access_token({"sub": "user1", "role": "user"})
        res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403

    def test_admin_can_access_admin_endpoint(self):
        token = create_access_token({"sub": "admin1", "role": "admin"})
        cur = MagicMock()
        cur.fetchall.return_value = []
        conn = MagicMock()
        conn.cursor.return_value = cur
        with patch("backend.routers.admin.get_connection", return_value=conn):
            res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200

    def test_user_cannot_delete_sensor(self):
        token = create_access_token({"sub": "user1", "role": "user"})
        res = client.delete("/api/admin/sensors/1", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403
