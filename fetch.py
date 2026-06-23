import requests
import json
import csv
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

url = "https://api.webstorage.jp/v1/devices/current"
log_file = "/home/kuruma/thermo/data/thermo_data.csv"

payload = {
    "api-key": os.environ["API_KEY"],
    "login-id": os.environ["LOGIN_ID"],
    "login-pass": os.environ["LOGIN_PASS"],
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
