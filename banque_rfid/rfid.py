from rc522_spi_library import RC522SPILibrary

reader = RC522SPILibrary()

def read_uid():
    uid = reader.read_uid()
    if uid is None:
        return None
    return ''.join(f"{b:02X}" for b in uid)
