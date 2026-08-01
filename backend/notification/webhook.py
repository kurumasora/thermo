import requests
import json
import os
from typing import Optional


class TeamsWebhook:
    def __init__(self, sensor_url: Optional[str] = None):
        # センサ固有URLが設定されていればそれを使用、なければグローバルURLにフォールバック
        self.url = sensor_url or os.environ.get("TEAMS_WEBHOOK_URL")
        if not self.url:
            raise ValueError("Webhook URLが設定されていません（センサ個別URL未設定、TEAMS_WEBHOOK_URLも未設定）")

    def send(self, message: str) -> None:
        payload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "TextBlock",
                                "text": message,
                                "wrap": True
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "version": "1.2"
                    }
                }
            ]
        }
        res = requests.post(self.url, headers={"Content-Type": "application/json"}, data=json.dumps(payload))
        if res.status_code not in [200, 202]:
            raise Exception(f"Teams通知エラー: {res.status_code}")
