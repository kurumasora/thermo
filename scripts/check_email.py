"""
メール通知テストスクリプト
使い方:
    .venv/bin/python test_email.py <送信先メールアドレス>
"""
import sys
from dotenv import load_dotenv
load_dotenv()

from backend.db import get_connection
from backend.notifiers.email import load_email_notifier

def main():
    if len(sys.argv) < 2:
        print("使い方: .venv/bin/python test_email.py <送信先メールアドレス>")
        sys.exit(1)

    to_address = sys.argv[1]
    conn = get_connection()
    try:
        notifier = load_email_notifier(conn)
        if notifier is None:
            print("エラー: SMTP設定が未完了です。管理画面の「通知設定」タブでSMTP設定を行ってください。")
            sys.exit(1)

        print(f"SMTP: {notifier.host}:{notifier.port}")
        print(f"送信元: {notifier.from_address}")
        print(f"送信先: {to_address}")
        print("送信中...")

        notifier.send([to_address], "【Thermonitor テスト】\n\nこのメールはThermonitorのメール通知テストです。\n正常に受信できていれば設定は完了です。")
        print("送信成功！")
    except Exception as e:
        print(f"送信失敗: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
