import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from backend.db import get_connection
from backend.auth.utils import get_current_user

router = APIRouter()


@router.get("/api/measurements")
def get_measurements(user: dict = Depends(get_current_user)):
    """全アクティブセンサの直近100件（チャンネルごと）を返す"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT m.id, m.timestamp, m.sensor_channel_id, m.value
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
            ORDER BY m.timestamp DESC
            LIMIT 500
            """
        )
        rows = cur.fetchall()
        return [
            {"id": r[0], "timestamp": str(r[1]), "sensor_channel_id": r[2], "value": r[3]}
            for r in rows
        ]
    finally:
        conn.close()


@router.get("/api/measurements/latest")
def get_latest(user: dict = Depends(get_current_user)):
    """チャンネルごとの最新値を返す {sensor_channel_id: value}"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT ON (m.sensor_channel_id)
                m.sensor_channel_id, m.value, m.timestamp
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
            ORDER BY m.sensor_channel_id, m.timestamp DESC
            """
        )
        rows = cur.fetchall()
        return {str(r[0]): {"value": r[1], "timestamp": str(r[2])} for r in rows}
    finally:
        conn.close()


@router.get("/api/measurements/export")
def export_measurements_csv(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """計測データをCSV形式でエクスポート"""
    conn = get_connection()
    try:
        cur = conn.cursor()

        # センサ・チャンネル一覧を取得
        cur.execute("""
            SELECT sc.id, s.name, sc.name, sc.unit
            FROM sensor_channels sc
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
            ORDER BY s.id, sc.channel_no
        """)
        channels = cur.fetchall()  # (id, sensor_name, channel_name, unit)

        # 期間フィルタ付きで計測データ取得
        query = """
            SELECT m.timestamp, m.sensor_channel_id, m.value
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
        """
        params = []
        if date_from:
            query += " AND m.timestamp >= %s"
            params.append(date_from)
        if date_to:
            query += " AND m.timestamp <= %s"
            params.append(date_to + " 23:59:59")
        query += " ORDER BY m.timestamp DESC"

        cur.execute(query, params)
        rows = cur.fetchall()

        # タイムスタンプ→チャンネルID→値 のマップを構築
        data_map: dict = {}
        for ts, ch_id, value in rows:
            key = str(ts)
            if key not in data_map:
                data_map[key] = {}
            data_map[key][ch_id] = value

        # CSV生成
        output = io.StringIO()
        writer = csv.writer(output)

        # ヘッダー行
        header = ["タイムスタンプ"] + [f"{s_name} {ch_name}（{unit}）" for _, s_name, ch_name, unit in channels]
        writer.writerow(header)

        # データ行
        for ts in sorted(data_map.keys(), reverse=True):
            row = [ts] + [data_map[ts].get(ch_id, "") for ch_id, _, _, _ in channels]
            writer.writerow(row)

        output.seek(0)
        filename = "measurements.csv"
        if date_from or date_to:
            filename = f"measurements_{(date_from or '').replace('-','')}_{(date_to or '').replace('-','')}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    finally:
        conn.close()


@router.get("/api/alerts")
def get_alerts(user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ah.id, ah.timestamp, ah.sensor_channel_id,
                   sc.name AS channel_name, sc.unit,
                   s.name AS sensor_name,
                   ah.alert_type, ah.value, ah.message, ah.predicted_steps
            FROM alert_history ah
            JOIN sensor_channels sc ON sc.id = ah.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            ORDER BY ah.timestamp DESC
            LIMIT 200
            """
        )
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "timestamp": str(r[1]),
                "sensor_channel_id": r[2],
                "channel_name": r[3],
                "unit": r[4],
                "sensor_name": r[5],
                "alert_type": r[6],
                "value": r[7],
                "message": r[8],
                "predicted_steps": r[9],
            }
            for r in rows
        ]
    finally:
        conn.close()
