from MFRC522 import MFRC522

reader = MFRC522()

def read_uid():
    print("Scan a card...")
    (status, tag_type) = reader.MFRC522_Request(reader.PICC_REQIDL)
    if status != reader.MI_OK:
        return None

    (status, uid) = reader.MFRC522_Anticoll()
    if status != reader.MI_OK:
        return None

    uid_hex = ''.join([hex(x)[2:] for x in uid])
    return uid_hex
