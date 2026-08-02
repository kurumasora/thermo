import time
import logging
from backend.monitor import main

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 10 * 60  # 10分

if __name__ == "__main__":
    logger.info("monitor_loop 開始")
    while True:
        try:
            main()
        except Exception as e:
            logger.error(f"monitor実行エラー: {e}", exc_info=True)
        time.sleep(INTERVAL_SECONDS)
