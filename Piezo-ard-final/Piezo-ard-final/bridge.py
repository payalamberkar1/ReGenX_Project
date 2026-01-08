import serial
import json
import time
import datetime
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient

# ==========================================================
# USER CONFIGURATION (EDIT THESE LINES)
# ==========================================================
SERIAL_PORT = 'COM6'   # <--- Change this to your Port (e.g., COM3, COM5)
AWS_ENDPOINT = "a3lzw27p9r4cu9-ats.iot.ap-south-1.amazonaws.com" # <--- Paste Endpoint from Step 1.5
# ==========================================================

# Constants
BAUD_RATE = 115200
CLIENT_ID = "PiezoLaptopGateway"
TOPIC = "piezo/stream"

# AWS Connection Setup
mqtt_client = AWSIoTMQTTClient(CLIENT_ID)
mqtt_client.configureEndpoint(AWS_ENDPOINT, 8883)

# POINTING TO CERTIFICATES (Must be in the same folder as this script)
mqtt_client.configureCredentials("root-CA.pem", "private.pem.key", "certificate.pem.crt")

print("---------------------------------------")
print(f"Connecting to AWS Endpoint: {AWS_ENDPOINT}")
try:
    mqtt_client.connect()
    print("SUCCESS: Connected to AWS IoT Core!")
except Exception as e:
    print(f"ERROR: Could not connect to AWS. Check certificates.\n{e}")
    exit()

print("---------------------------------------")
print(f"Opening Serial Connection on {SERIAL_PORT}...")
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    # Wait for Arduino to reset
    time.sleep(2) 
    print("SUCCESS: Serial Port Open. Listening for steps...")
except Exception as e:
    print(f"ERROR: Could not open {SERIAL_PORT}. Is Arduino plugged in?\n{e}")
    exit()

# Main Loop
while True:
    if ser.in_waiting > 0:
        try:
            # 1. Read raw line from Arduino
            line = ser.readline().decode('utf-8').strip()
            
            # Skip empty lines
            if not line:
                continue

            print(f"Raw Arduino Data: {line}") # Debugging print

            # 2. Parse JSON
            data = json.loads(line)
            
            # 3. Construct Payload for AWS
            payload = {
                "device_id": "laptop_setup_01",
                "timestamp": str(datetime.datetime.now()), # Current Laptop Time
                "voltage": data['v'],
                "step_detected": data['s']
            }
            
            # 4. Send to AWS
            json_payload = json.dumps(payload)
            mqtt_client.publish(TOPIC, json_payload, 1)
            print(f" [UPLOADED] -> {json_payload}")
            
        except json.JSONDecodeError:
            print("Warning: Received corrupted data, skipping...")
        except Exception as e:
            print(f"Error: {e}")