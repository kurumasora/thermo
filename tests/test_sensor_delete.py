"""センサ削除カスケードテスト

alert_history に ON DELETE CASCADE がないため、DELETE FROM sensor_channels より先に
alert_history を手動削除する必要がある。そのクエリ順を検証する。
"""
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.auth.utils import create_access_token

client = TestClient(app)


def admin_token():
    return create_access_token({"sub": "admin1", "role": "admin"})


def make_conn(sensor_exists=True):
    cur = MagicMock()
    cur.fetchone.return_value = (1,) if sensor_exists else None
    cur.fetchall.return_value = []
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def executed_sqls(cur):
    return [str(call) for call in cur.execute.call_args_list]


def test_alert_history_deleted_before_sensor_channels():
    """alert_history の削除が sensor_channels の削除より前に実行される"""
    conn, cur = make_conn(sensor_exists=True)
    with patch("backend.routers.sensors.get_connection", return_value=conn):
        res = client.delete(
            "/api/admin/sensors/1",
            headers={"Authorization": f"Bearer {admin_token()}"},
        )

    sqls = executed_sqls(cur)
    # alert_history を対象とするクエリ（FROM alert_history）のインデックス
    alert_idx   = next((i for i, s in enumerate(sqls) if "FROM alert_history" in s), None)
    # sensor_channels を直接 DELETE するクエリのインデックス（サブクエリでの参照は除外）
    channel_idx = next((i for i, s in enumerate(sqls) if "DELETE FROM sensor_channels" in s), None)

    assert alert_idx is not None,   "alert_history の削除が見つからない"
    assert channel_idx is not None, "sensor_channels の削除が見つからない"
    assert alert_idx < channel_idx, (
        f"alert_history(index={alert_idx}) が sensor_channels(index={channel_idx}) より後に実行されている"
    )


def test_delete_returns_404_for_unknown_sensor():
    """存在しないセンサIDは 404 を返す"""
    conn, cur = make_conn(sensor_exists=False)
    with patch("backend.routers.sensors.get_connection", return_value=conn):
        res = client.delete(
            "/api/admin/sensors/9999",
            headers={"Authorization": f"Bearer {admin_token()}"},
        )
    assert res.status_code == 404


def test_delete_requires_admin():
    """一般ユーザーはセンサを削除できない（403）"""
    token = create_access_token({"sub": "user1", "role": "user"})
    res = client.delete("/api/admin/sensors/1", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
