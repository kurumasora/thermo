from dotenv import load_dotenv
load_dotenv()

from backend.devices.ondotori import OndotoriDevice

device = OndotoriDevice()
data = device.get_data()

for d in data:
    print(f"CH{d.channel}: {d.value}{d.unit} ({d.timestamp})")

    