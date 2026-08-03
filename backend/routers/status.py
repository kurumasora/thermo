import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from backend.db import get_connection
from backend.auth.utils import get_current_user

router = APIRouter()


@router.get("/api/measurements")
def get_measurements(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """指定期間のアクティブセンサ計測データを返す。未指定時は直近500件"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        conditions = ["s.active = TRUE"]
        params: list = []
        if date_from:
            conditions.append("m.timestamp >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("m.timestamp <= %s")
            params.append(date_to)
        where = " AND ".join(conditions)
        limit_clause = "LIMIT 500" if not (date_from or date_to) else ""
        cur.execute(
            f"""
            SELECT m.id, m.timestamp, m.sensor_channel_id, m.value
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE {where}
            ORDER BY m.timestamp DESC
            {limit_clause}
            """,
            params,
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
    sensor_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
):
    """計測データをCSV形式でエクスポート"""
    conn = get_connection()
    try:
        cur = conn.cursor()

        # センサ・チャンネル一覧を取得
        channel_query = """
            SELECT sc.id, s.name, sc.name, sc.unit
            FROM sensor_channels sc
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
        """
        channel_params = []
        if sensor_id:
            channel_query += " AND s.id = %s"
            channel_params.append(sensor_id)
        channel_query += " ORDER BY s.id, sc.channel_no"
        cur.execute(channel_query, channel_params)
        channels = cur.fetchall()  # (id, sensor_name, channel_name, unit)

        # 期間・センサフィルタ付きで計測データ取得
        query = """
            SELECT m.timestamp, m.sensor_channel_id, m.value
            FROM measurements m
            JOIN sensor_channels sc ON sc.id = m.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE s.active = TRUE
        """
        params = []
        if sensor_id:
            query += " AND s.id = %s"
            params.append(sensor_id)
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
        output.write('﻿')  # UTF-8 BOM（Excelで文字化けしないために必要）
        writer = csv.writer(output)

        # ヘッダー行
        header = ["タイムスタンプ"] + [f"{s_name} {ch_name}（{unit}）" for _, s_name, ch_name, unit in channels]
        writer.writerow(header)

        # データ行
        for ts in sorted(data_map.keys(), reverse=True):
            ts_str = str(ts)[:19]  # タイムゾーン部分を除去して YYYY-MM-DD HH:MM:SS に統一
            row = [ts_str] + [data_map[ts].get(ch_id, "") for ch_id, _, _, _ in channels]
            writer.writerow(row)

        output.seek(0)
        sensor_name_part = ""
        if sensor_id and channels:
            sensor_name_part = "_" + channels[0][1].replace(" ", "_")
        date_part = f"_{(date_from or '').replace('-','')}_{(date_to or '').replace('-','')}" if (date_from or date_to) else ""
        filename = f"measurements{sensor_name_part}{date_part}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    finally:
        conn.close()


@router.get("/api/alerts/export")
def export_alerts_csv(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sensor_id: Optional[int] = Query(None),
    alert_type: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """アラート履歴をCSV形式でエクスポート"""
    conn = get_connection()
    try:
        cur = conn.cursor()

        query = """
            SELECT ah.timestamp, s.name, sc.name, sc.unit,
                   ah.alert_type, ah.value, ah.message
            FROM alert_history ah
            JOIN sensor_channels sc ON sc.id = ah.sensor_channel_id
            JOIN sensors s ON s.id = sc.sensor_id
            WHERE 1=1
        """
        params = []
        if sensor_id:
            query += " AND s.id = %s"
            params.append(sensor_id)
        if alert_type in ("threshold", "trend"):
            query += " AND ah.alert_type = %s"
            params.append(alert_type)
        if date_from:
            query += " AND ah.timestamp >= %s"
            params.append(date_from)
        if date_to:
            query += " AND ah.timestamp <= %s"
            params.append(date_to + " 23:59:59")
        query += " ORDER BY ah.timestamp DESC"

        cur.execute(query, params)
        rows = cur.fetchall()

        output = io.StringIO()
        output.write('﻿')  # UTF-8 BOM
        writer = csv.writer(output)
        writer.writerow(["タイムスタンプ", "センサ名", "チャンネル名", "単位", "種別", "値", "メッセージ"])
        for r in rows:
            ts_str = str(r[0])[:19]
            alert_label = "閾値超過" if r[4] == "threshold" else "傾向異常"
            writer.writerow([ts_str, r[1], r[2], r[3], alert_label, r[5], r[6]])

        output.seek(0)
        sensor_part = ""
        if sensor_id and rows:
            sensor_part = "_" + rows[0][1].replace(" ", "_")
        date_part = f"_{(date_from or '').replace('-','')}_{(date_to or '').replace('-','')}" if (date_from or date_to) else ""
        filename = f"alerts{sensor_part}{date_part}.csv"

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
                   s.id AS sensor_id, s.name AS sensor_name,
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
                "sensor_id": r[5],
                "sensor_name": r[6],
                "alert_type": r[7],
                "value": r[8],
                "message": r[9],
                "predicted_steps": r[10],
            }
            for r in rows
        ]
    finally:
        conn.close()
