import requests
import json
import csv
from datetime import datetime
import os

url = "https://api.webstorage.jp/v1/devices/current"
log_file = "/home/kuruma/thermo/data/thermo_data.csv" # 保存先のパス（環境に合わせて変更してください）

payload = {
    "api-key": "6ket3lo48nlhuvmerj3h6gad5m0bis4fac5c1hscka6kf",
    "login-id": "tbai3831",
    "login-pass": "Marlowe0127"
}

headers = {
    "Content-Type": "application/json",
    "X-HTTP-Method-Override": "GET"
}

def main():
    try:
        res = requests.post(url, headers=headers, data=json.dumps(payload))
        if res.status_code == 200:
            data = res.json()
            device = data["devices"][0]
            
            # データの抽出
            timestamp = datetime.fromtimestamp(int(device["unixtime"])).strftime('%Y-%m-%d %H:%M:%S')
            ch1_val = device["channel"][0]["value"]
            ch2_val = device["channel"][1]["value"]
            battery = device["battery"]

            # CSVファイルに追記（ファイルがなければヘッダーを作成）
            file_exists = os.path.isfile(log_file)
            with open(log_file, "a", newline="") as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow(["timestamp", "temp_ch1", "temp_ch2", "battery_level"])
                writer.writerow([timestamp, ch1_val, ch2_val, battery])
            
            print(f"保存完了: {timestamp} / {ch1_val}C, {ch2_val}C")
        else:
            print(f"APIエラー: {res.status_code}")
    except Exception as e:
        print(f"実行エラー: {e}")

if __name__ == "__main__":
    main()