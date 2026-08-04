"""Docker用の常駐モニタープロセス。1分ごとにmonitor.main()を呼ぶ。
インターバル制御はmonitor.main()内のDB設定で行う。"""
import time
import logging
from backend.monitor import main

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("monitor_loop 開始")
    while True:
        try:
            main()
        except Exception as e:
            logger.error(f"monitor.main() エラー: {e}")
        time.sleep(60)
