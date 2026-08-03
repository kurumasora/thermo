import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)


class EmailNotification:
    def __init__(self, host: str, port: int, username: str, password: str, from_address: str):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_address = from_address

    def send(self, to_addresses: list[str], message: str) -> None:
        if not to_addresses:
            return
        msg = MIMEMultipart()
        msg["From"] = self.from_address
        msg["To"] = ", ".join(to_addresses)
        msg["Subject"] = "【Thermonitor】アラート通知"
        msg.attach(MIMEText(message, "plain", "utf-8"))

        with smtplib.SMTP(self.host, self.port) as smtp:
            smtp.starttls()
            smtp.login(self.username, self.password)
            smtp.sendmail(self.from_address, to_addresses, msg.as_string())


def load_email_notifier(conn) -> Optional[EmailNotification]:
    """DBからSMTP設定を読み込んでEmailNotificationを返す。未設定ならNone。"""
    cur = conn.cursor()
    cur.execute("SELECT host, port, username, password, from_address FROM smtp_config WHERE id = 1")
    row = cur.fetchone()
    if not row or not all([row[0], row[2], row[3], row[4]]):
        logger.warning("SMTP設定が未完了のためメール通知をスキップします")
        return None
    return EmailNotification(host=row[0], port=row[1], username=row[2], password=row[3], from_address=row[4])
