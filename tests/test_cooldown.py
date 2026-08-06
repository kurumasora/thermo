"""アラートクールダウンテスト"""
from unittest.mock import patch, MagicMock
from backend.monitor import main
from backend.interfaces import MeasurementData

SENSOR_ROWS = [(1, "ondotori_1", "Test", "http://webhook", True, False)]
TIMESTAMP   = "2026-08-01 10:00:00"
OVER_VALUE  = 35.0  # 上限30℃を超える値


def make_mock(fetchone_side_effect, fetchall_side_effect):
    cur = MagicMock()
    cur.fetchone.side_effect = fetchone_side_effect
    cur.fetchall.side_effect = fetchall_side_effect
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def channel_config_row(upper=30.0, lower=20.0):
    # upper, lower, trend_monitor, judgement_type, judgement_params
    return (upper, lower, False, "linear", {})


def run_monitor_with_value(conn, value: float):
    data = [MeasurementData(channel=1, value=value, unit="℃", timestamp=TIMESTAMP)]
    mock_device = MagicMock()
    mock_device.get_data.return_value = data
    with patch("backend.monitor.get_connection", return_value=conn), \
         patch("backend.monitor.SENSOR_MAP", {"ondotori_1": lambda: mock_device}), \
         patch("backend.monitor.load_email_notifier", return_value=None), \
         patch("backend.monitor.send_notifications") as mock_notify:
        main()
    return mock_notify


def inserted_alerts(cur):
    return [
        args for args in cur.execute.call_args_list
        if "INSERT INTO alert_history" in str(args)
    ]


def test_alert_fired_when_no_recent_alert():
    """直近60分にアラートがなければ、閾値超過時にアラートが発火する"""
    conn, cur = make_mock(
        fetchone_side_effect=[
            None,               # ondotoriタイムスタンプは新規
            None,               # 重複チェック → 新規
            channel_config_row(),  # channel_config fetchone
            None,               # クールダウンチェック → 直近アラートなし → 発火
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,
            [],             # email_recipients
            [(1, 10)],      # channel_map
        ],
    )
    mock_notify = run_monitor_with_value(conn, OVER_VALUE)

    assert len(inserted_alerts(cur)) == 1
    mock_notify.assert_called_once()


def test_alert_suppressed_during_cooldown():
    """直近60分以内に同チャンネルのアラートがあれば、新たなアラートは発火しない"""
    conn, cur = make_mock(
        fetchone_side_effect=[
            None,               # ondotoriタイムスタンプは新規
            None,               # 重複チェック → 新規
            channel_config_row(),  # channel_config fetchone
            (1,),               # クールダウンチェック → 直近アラートあり → スキップ
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,
            [],
            [(1, 10)],
        ],
    )
    mock_notify = run_monitor_with_value(conn, OVER_VALUE)

    assert len(inserted_alerts(cur)) == 0
    mock_notify.assert_not_called()


def test_no_alert_for_normal_value():
    """正常値ではアラートが発火しない"""
    conn, cur = make_mock(
        fetchone_side_effect=[
            None,               # ondotoriタイムスタンプは新規
            None,               # 重複チェック → 新規
            channel_config_row(),  # channel_config fetchone → 正常値なのでクールダウンチェックなし
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,
            [],
            [(1, 10)],
        ],
    )
    mock_notify = run_monitor_with_value(conn, 25.0)  # 正常値

    assert len(inserted_alerts(cur)) == 0
    mock_notify.assert_not_called()
