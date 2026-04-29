import requests
import json

# APIエンドポイント
url = "https://api.webstorage.jp/v1/devices/current"

# 送信するデータ（認証情報をここに含めるのが正解です）
payload = {
    "api-key": "6ket3lo48nlhuvmerj3h6gad5m0bis4fac5c1hscka6kf",
    "login-id": "tbai3831",
    "login-pass": "Marlowe0127"
}

# HTTPヘッダーの設定
headers = {
    "Host": "api.webstorage.jp:443",
    "Content-Type": "application/json",
    "X-HTTP-Method-Override": "GET" # 実際はGETの動作をさせるための指定
}

try:
    # POSTメソッドで送信
    res = requests.post(url, headers=headers, data=json.dumps(payload))
    
    # 結果の表示
    if res.status_code == 200:
        print("--- データの取得に成功しました ---")
        print(json.dumps(res.json(), indent=2, ensure_ascii=False))
    else:
        print(f"エラーが発生しました（ステータスコード: {res.status_code}）")
        print(res.text)

except Exception as e:
    print(f"通信エラー: {e}")