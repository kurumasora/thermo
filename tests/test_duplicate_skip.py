"""計測データの重複スキップテスト"""
from unittest.mock import patch, MagicMock, call
from backend.monitor import main
from backend.interfaces import MeasurementData

SENSOR_ROWS = [(1, 'ondotori_1', 'Test', None, False, False)]
TIMESTAMP = "2026-08-01 10:00:00"


def make_mock(fetchone_side_effect, fetchall_side_effect):
    cur = MagicMock()
    cur.fetchone.side_effect = fetchone_side_effect
    cur.fetchall.side_effect = fetchall_side_effect
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def run_monitor(conn, data_list):
    mock_device = MagicMock()
    mock_device.get_data.return_value = data_list
    with patch("backend.monitor.get_connection", return_value=conn), \
         patch("backend.monitor.SENSOR_MAP", {"ondotori_1": lambda: mock_device}), \
         patch("backend.monitor.load_email_notifier", return_value=None):
        main()


def inserted_timestamps(cur):
    """INSERT INTO measurements の呼び出しからタイムスタンプを抽出"""
    return [
        args[0][1][0]   # execute(sql, (timestamp, channel_id, value)) の timestamp
        for args in cur.execute.call_args_list
        if "INSERT INTO measurements" in str(args)
    ]


def test_new_data_is_saved():
    """新しいタイムスタンプのデータは保存される"""
    conn, cur = make_mock(
        fetchone_side_effect=[
            None,   # ondotoriタイムスタンプは新規（DBにない）
            None,   # 重複チェック → なし → 保存へ
            None,   # channel_config → 未設定なら異常判定スキップ
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,    # active_sensors
            [],             # email_recipients
            [(1, 10)],      # channel_map (channel_no=1, channel_id=10)
        ],
    )
    data = [MeasurementData(channel=1, value=25.0, unit="℃", timestamp=TIMESTAMP)]
    run_monitor(conn, data)

    assert len(inserted_timestamps(cur)) == 1


def test_duplicate_timestamp_is_skipped():
    """同じタイムスタンプのデータが既にDBにある場合、保存されない"""
    conn, cur = make_mock(
        fetchone_side_effect=[
            None,   # ondotoriタイムスタンプは新規
            (1,),   # 重複チェック → 既存あり → スキップ
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,
            [],
            [(1, 10)],
        ],
    )
    data = [MeasurementData(channel=1, value=25.0, unit="℃", timestamp=TIMESTAMP)]
    run_monitor(conn, data)

    assert len(inserted_timestamps(cur)) == 0


def test_stale_ondotori_does_not_block_other_sensors():
    """ondotoriが旧タイムスタンプを返すとき、他センサは独自タイムスタンプで保存される"""
    sensor_rows = [
        (1, "ondotori_1",     "Ondotori", None, False, False),
        (2, "dummy_humidity", "Dummy",    None, False, False),
    ]
    ondotori_data = [MeasurementData(channel=1, value=25.0, unit="℃", timestamp="2026-08-01 10:00:00")]
    dummy_data    = [MeasurementData(channel=1, value=60.0, unit="%",  timestamp="2026-08-01 10:05:00")]

    conn, cur = make_mock(
        fetchone_side_effect=[
            (1,),   # ondotoriタイムスタンプはDB既存（旧データ）→ 統一しない
            (1,),   # ondotori 重複チェック → スキップ
            None,   # dummy 重複チェック → 新規 → 保存
            None,   # dummy channel_config → 未設定なら異常判定スキップ
        ],
        fetchall_side_effect=[
            sensor_rows,    # active_sensors
            [],             # email_recipients (ondotori)
            [(1, 10)],      # channel_map (ondotori)
            [],             # email_recipients (dummy)
            [(1, 20)],      # channel_map (dummy)
        ],
    )

    ondotori_device = MagicMock()
    ondotori_device.get_data.return_value = ondotori_data
    dummy_device = MagicMock()
    dummy_device.get_data.return_value = dummy_data

    def sensor_factory(key):
        return lambda: (ondotori_device if key == "ondotori_1" else dummy_device)

    with patch("backend.monitor.get_connection", return_value=conn), \
         patch("backend.monitor.SENSOR_MAP", {
             "ondotori_1":     sensor_factory("ondotori_1"),
             "dummy_humidity": sensor_factory("dummy_humidity"),
         }), \
         patch("backend.monitor.load_email_notifier", return_value=None):
        main()

    # dummyだけが保存され、ondotoriのタイムスタンプは使われていない
    timestamps = inserted_timestamps(cur)
    assert len(timestamps) == 1
    assert timestamps[0] == "2026-08-01 10:05:00"
