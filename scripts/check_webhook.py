from dotenv import load_dotenv
load_dotenv()

from backend.notification.webhook import TeamsWebhook

webhook = TeamsWebhook()
webhook.send("テスト通知：閾値以上を検知しました")
print("送信完了")