from pirc522 import RFID

rdr = RFID()
util = rdr.util()
util.debug = False

def read_uid():
    rdr.wait_for_tag()
    (error, data) = rdr.request()
    if error:
        return None
    (error, uid) = rdr.anticoll()
    if error:
        return None
    return ''.join(f"{i:02X}" for i in uid)

def write_message(message):
    # Exemple d’écriture simple sur une carte Mifare Classic bloc 8
    rdr.wait_for_tag()
    (error, data) = rdr.request()
    if error:
        raise Exception("No tag detected")
    (error, uid) = rdr.anticoll()
    if error:
        raise Exception("Failed anticollision")

    # Authentification sur le bloc 8 avec clé par défaut (0xFF * 6)
    key = [0xFF]*6
    if not rdr.select_tag(uid):
        raise Exception("Failed to select tag")
    if not rdr.auth(rdr.auth_a, 8, key, uid):
        raise Exception("Authentication error")

    # Préparer les données à écrire (16 octets)
    data_to_write = bytearray(16)
    message_bytes = message.encode('utf-8')[:16]
    data_to_write[:len(message_bytes)] = message_bytes

    # Écrire sur le bloc 8
    if not rdr.write(8, data_to_write):
        raise Exception("Write error")

    rdr.stop_crypto()