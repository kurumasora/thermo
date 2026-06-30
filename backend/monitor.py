from dotenv import load_dotenv
load_dotenv()

from backend.devices.ondotori import OndotoriDevice
from backend.judgement.threshold import ThresholdJudgement
from backend.judgement.trend import TrendJudgement
from backend.notification.webhook import TeamsWebhook
from backend.db import get_connection

def main():
    device = OndotoriDevice()
    data_list = device.get_data()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM measurements WHERE timestamp = %s",
        (data_list[0].timestamp,)
    )
    if cur.fetchone() is not None:
        cur.close()
        conn.close()
        return

    cur.execute(
        "INSERT INTO measurements (timestamp, temp_ch1, temp_ch2, battery_level) VALUES(%s, %s, %s, %s)",
        (data_list[0].timestamp, data_list[0].value, data_list[1].value, None)
    )
    conn.commit()

    for data in data_list:
        cur.execute(
            "SELECT upper_threshold, lower_threshold, slope_threshold, regression_count, trend_monitor FROM master_config WHERE channel = %s",
            (data.channel,)
        )
        config = cur.fetchone()
        if config is None:
            continue
        upper, lower, slope_threshold, regression_count, trend_monitor = config

        threshold = ThresholdJudgement(upper=upper, lower=lower)
        result = threshold.judge(data)

        if result["is_abnormal"]:
            webhook = TeamsWebhook()
            webhook.send(result["message"])
            cur.execute(
                "INSERT INTO alert_history (timestamp, channel, alert_type, value, message) VALUES(%s, %s, %s, %s, %s)", 
                (data.timestamp, data.channel, "threshold", data.value, result["message"])
            )
            conn.commit()

        if trend_monitor:
                cur.execute(
                    "SELECT timestamp, temp_ch1, temp_ch2 FROM measurements ORDER BY timestamp DESC LIMIT %s",
                    (regression_count,)
                )
                rows = cur.fetchall()
        
                trend_data = [
                    data.__class__(
                        channel=data.channel,
                        value=row[1] if data.channel == 1 else row[2],
                        unit="℃",
                        timestamp=str(row[0])
                    )
                    for row in rows
                ]
        
                trend = TrendJudgement(slope_threshold=slope_threshold, upper=upper, lower=lower)
                trend_result = trend.judge(trend_data)
        
                if trend_result["is_abnormal"]:
                    webhook = TeamsWebhook()
                    webhook.send(trend_result["message"])
                    cur.execute(
                        "INSERT INTO alert_history (timestamp, channel, alert_type, value, message, predicted_steps) VALUES (%s, %s, %s, %s, %s, %s)",
                        (data.timestamp, data.channel, "trend", data.value, trend_result["message"], trend_result["predicted_steps"])
                    )
                    conn.commit()


    

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()