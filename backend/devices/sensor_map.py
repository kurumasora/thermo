from backend.devices.ondotori import OndotoriDevice
from backend.devices.dummy_sensor import DummyHumiditySensor

# 新しいセンサを追加するときはここに1行追加する
# キーはDBのsensors.sensor_keyと一致させること
SENSOR_MAP = {
    'ondotori_1': OndotoriDevice,
    'dummy_humidity': DummyHumiditySensor,
}
