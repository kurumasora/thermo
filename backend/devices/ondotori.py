import requests
import json
import os
from datetime import datetime
from backend.interfaces import IMeasurementDevice, MeasurementData

class OndotoriDevice(IMeasurementDevice):
    def __init__(self):
        self.url = "https://api.webstorage.jp/v1/devices/current"
        self.payload = {
            "api-key": os.environ["API_KEY"],
            "login-id": os.environ["LOGIN_ID"],
            "login-pass": os.environ["LOGIN_PASS"], 
        }
        self.headers = {
            "Content-Type": "application/json",
            "X-HTTP-Method-Override": "GET"
        }
    def get_data(self) -> list[MeasurementData]:
        res = requests.post(self.url, headers=self.headers, data=json.dumps(self.payload))
        if res.status_code != 200:
            raise Exception(f"API error: {res.status_code}")
        device = res.json()["devices"][0]
        timestamp = datetime.fromtimestamp(int(device["unixtime"])).strftime('%Y-%m-%d %H:%M:%S')
        return [
            MeasurementData(channel=1, value=float(device["channel"][0]["value"]),unit="℃", timestamp=timestamp),
            MeasurementData(channel=2, value=float(device["channel"][1]["value"]),unit="℃", timestamp=timestamp),
        ]


