import requests
import json
import os

class TeamsWebhook:
    def __init__(self):
        self.url = os.environ["TEAMS_WEBHOOK_URL"]

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

        
    