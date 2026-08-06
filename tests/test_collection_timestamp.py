"""収集時刻タイムスタンプ統一のテスト"""
from unittest.mock import patch, MagicMock
from datetime import datetime
from backend.monitor import main
from backend.interfaces import MeasurementData


SENSOR_ROWS = [
    (1, "ondotori_1",     "Ondotori", None, False, False),
    (2, "dummy_humidity", "Dummy",    None, False, False),
]
FIXED_NOW = "2026-08-04 10:00:00"


def inserted_timestamps(cur):
    return [
        args[0][1][0]
        for args in cur.execute.call_args_list
        if "INSERT INTO measurements" in str(args)
    ]


def make_conn(fetchone_side_effect, fetchall_side_effect):
    cur = MagicMock()
    cur.fetchone.side_effect = fetchone_side_effect
    cur.fetchall.side_effect = fetchall_side_effect
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur



def test_all_sensors_use_collection_timestamp():
    """全センサが収集時刻（cron実行時刻）で統一されて保存される"""
    conn, cur = make_conn(
        fetchone_side_effect=[
            ("10",),    # app_settings: interval
            (None,),    # MAX(timestamp): 初回なので None → スキップしない
            None,       # ondotori channel_config
            None,       # dummy channel_config
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,
            [],             # email_recipients (ondotori)
            [(1, 10)],      # channel_map (ondotori)
            [],             # email_recipients (dummy)
            [(1, 20)],      # channel_map (dummy)
        ],
    )

    ondotori_data = [MeasurementData(channel=1, value=25.0, unit="℃", timestamp="2026-08-04 09:50:00")]
    dummy_data    = [MeasurementData(channel=1, value=60.0, unit="%",  timestamp="2026-08-04 09:55:00")]

    ondotori_device = MagicMock(); ondotori_device.get_data.return_value = ondotori_data
    dummy_device    = MagicMock(); dummy_device.get_data.return_value    = dummy_data

    fixed_dt = MagicMock()
    fixed_dt.now.return_value.strftime.return_value = FIXED_NOW
    fixed_dt.now.return_value.tzinfo = None

    with patch("backend.monitor.get_connection", return_value=conn), \
         patch("backend.monitor.SENSOR_MAP", {
             "ondotori_1":     lambda: ondotori_device,
             "dummy_humidity": lambda: dummy_device,
         }), \
         patch("backend.monitor.load_email_notifier", return_value=None), \
         patch("backend.monitor.datetime", fixed_dt):
        main()

    timestamps = inserted_timestamps(cur)
    assert len(timestamps) == 2, f"2件保存されるはず: {timestamps}"
    assert all(ts == FIXED_NOW for ts in timestamps), f"全タイムスタンプが収集時刻と一致しない: {timestamps}"


def test_ondotori_offline_does_not_affect_other_sensors():
    """ondotoriがオフラインでも他センサは収集時刻で保存される"""
    conn, cur = make_conn(
        fetchone_side_effect=[
            ("10",),    # app_settings: interval
            (None,),    # MAX(timestamp): 初回
            None,       # dummy channel_config
        ],
        fetchall_side_effect=[
            SENSOR_ROWS,
            [],             # email_recipients (ondotori) ※エラーで早期離脱
            [],             # email_recipients (dummy)
            [(1, 20)],      # channel_map (dummy)
        ],
    )

    ondotori_device = MagicMock()
    ondotori_device.get_data.side_effect = Exception("デバイスエラー")
    dummy_data   = [MeasurementData(channel=1, value=60.0, unit="%", timestamp="2026-08-04 09:55:00")]
    dummy_device = MagicMock(); dummy_device.get_data.return_value = dummy_data

    fixed_dt = MagicMock()
    fixed_dt.now.return_value.strftime.return_value = FIXED_NOW
    fixed_dt.now.return_value.tzinfo = None

    with patch("backend.monitor.get_connection", return_value=conn), \
         patch("backend.monitor.SENSOR_MAP", {
             "ondotori_1":     lambda: ondotori_device,
             "dummy_humidity": lambda: dummy_device,
         }), \
         patch("backend.monitor.load_email_notifier", return_value=None), \
         patch("backend.monitor.datetime", fixed_dt):
        main()

    timestamps = inserted_timestamps(cur)
    assert len(timestamps) == 1, f"dummy_humidityのみ保存されるはず: {timestamps}"
    assert timestamps[0] == FIXED_NOW
