from rc522_spi_library import RC522SPILibrary

reader = RC522SPILibrary(reset_chip="GPIO25", chip_select=0, bus=0, device=0)


def read_uid():
    uid = reader.read_uid()
    if uid is None:
        return None
    return ''.join(f"{b:02X}" for b in uid)