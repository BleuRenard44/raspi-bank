import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522

reader = SimpleMFRC522()

def read_uid():
    try:
        print("Scan a card...")
        uid, _ = reader.read()
        return hex(uid)
    finally:
        GPIO.cleanup()