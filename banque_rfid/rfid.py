import gpiozero as GPIO
from mfrc522 import MFRC522

reader = MFRC522()

def read_uid():
    try:
        print("Scan a card...")
        uid, _ = reader.read()
        return hex(uid)
    finally:
        GPIO.cleanup()