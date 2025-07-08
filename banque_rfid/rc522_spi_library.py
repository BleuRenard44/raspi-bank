# rc522_spi_library.py
import time
import spidev
import gpiod

class RC522SPILibrary:
    MAX_LEN = 16
    PCD_IDLE = 0x00
    PCD_AUTHENT = 0x0E
    PCD_RECEIVE = 0x08
    PCD_TRANSMIT = 0x04
    PCD_TRANSCEIVE = 0x0C
    PCD_RESETPHASE = 0x0F
    PCD_CALCCRC = 0x03

    PICC_REQIDL = 0x26
    PICC_REQALL = 0x52
    PICC_ANTICOLL = 0x93
    PICC_SELECTTAG = 0x93
    PICC_AUTHENT1A = 0x60
    PICC_AUTHENT1B = 0x61
    PICC_READ = 0x30
    PICC_WRITE = 0xA0
    PICC_DECREMENT = 0xC0
    PICC_INCREMENT = 0xC1
    PICC_RESTORE = 0xC2
    PICC_TRANSFER = 0xB0
    PICC_HALT = 0x50

    Reserved00 = 0x00
    CommandReg = 0x01
    CommIEnReg = 0x02
    DivlEnReg = 0x03
    CommIrqReg = 0x04
    DivIrqReg = 0x05
    ErrorReg = 0x06
    Status1Reg = 0x07
    Status2Reg = 0x08
    FIFODataReg = 0x09
    FIFOLevelReg = 0x0A
    ControlReg = 0x0C
    BitFramingReg = 0x0D
    CollReg = 0x0E
    ModeReg = 0x11
    TxControlReg = 0x14
    TxASKReg = 0x15
    CRCResultRegL = 0x22
    CRCResultRegH = 0x21
    TModeReg = 0x2A
    TPrescalerReg = 0x2B
    TReloadRegH = 0x2C
    TReloadRegL = 0x2D

    def __init__(self, reset_chip="GPIO4", chip_select=0, bus=0, device=0):
        self.chip = gpiod.Chip('gpiochip4')
        self.line = self.chip.get_line(4)
        self.line.request(consumer="rc522", type=gpiod.LINE_REQ_DIR_OUT)
        self.spi = spidev.SpiDev()
        self.spi.open(bus, device)
        self.spi.max_speed_hz = 1000000
        self._reset()
        self._init()

    def _reset(self):
        self.line.set_value(0)
        time.sleep(0.1)
        self.line.set_value(1)
        time.sleep(0.1)

    def _init(self):
        self._write(self.CommandReg, self.PCD_RESETPHASE)
        self._write(self.TModeReg, 0x8D)
        self._write(self.TPrescalerReg, 0x3E)
        self._write(self.TReloadRegL, 30)
        self._write(self.TReloadRegH, 0)
        self._write(self.TxASKReg, 0x40)
        self._write(self.ModeReg, 0x3D)
        self._antenna_on()

    def _antenna_on(self):
        value = self._read(self.TxControlReg)
        if ~(value & 0x03):
            self._set_bit_mask(self.TxControlReg, 0x03)

    def _write(self, addr, val):
        self.spi.xfer2([(addr << 1) & 0x7E, val])

    def _read(self, addr):
        val = self.spi.xfer2([((addr << 1) & 0x7E) | 0x80, 0])
        return val[1]

    def _set_bit_mask(self, reg, mask):
        current = self._read(reg)
        self._write(reg, current | mask)

    def _clear_bit_mask(self, reg, mask):
        current = self._read(reg)
        self._write(reg, current & (~mask))

    def _to_card(self, command, send_data):
        back_data = []
        back_len = 0
        status = None
        irq_en = 0x00
        wait_irq = 0x00

        if command == self.PCD_AUTHENT:
            irq_en = 0x12
            wait_irq = 0x10
        if command == self.PCD_TRANSCEIVE:
            irq_en = 0x77
            wait_irq = 0x30

        self._write(self.CommIEnReg, irq_en | 0x80)
        self._clear_bit_mask(self.CommIrqReg, 0x80)
        self._set_bit_mask(self.FIFOLevelReg, 0x80)

        self._write(self.CommandReg, self.PCD_IDLE)

        for d in send_data:
            self._write(self.FIFODataReg, d)

        self._write(self.CommandReg, command)
        if command == self.PCD_TRANSCEIVE:
            self._set_bit_mask(self.BitFramingReg, 0x80)

        i = 2000
        while True:
            n = self._read(self.CommIrqReg)
            i -= 1
            if not (i != 0 and not (n & 0x01) and not (n & wait_irq)):
                break

        self._clear_bit_mask(self.BitFramingReg, 0x80)

        if i != 0:
            if (self._read(self.ErrorReg) & 0x1B) == 0x00:
                status = "OK"
                if n & irq_en & 0x01:
                    status = "NO_TAG"
                if command == self.PCD_TRANSCEIVE:
                    n = self._read(self.FIFOLevelReg)
                    last_bits = self._read(self.ControlReg) & 0x07
                    if last_bits != 0:
                        back_len = (n - 1) * 8 + last_bits
                    else:
                        back_len = n * 8

                    if n == 0:
                        n = 1
                    if n > self.MAX_LEN:
                        n = self.MAX_LEN

                    for _ in range(n):
                        back_data.append(self._read(self.FIFODataReg))
            else:
                status = "ERROR"
        return status, back_data, back_len

    def request(self, mode):
        self._write(self.BitFramingReg, 0x07)
        (status, back_data, back_bits) = self._to_card(self.PCD_TRANSCEIVE, [mode])
        if status != "OK" or back_bits != 0x10:
            status = "ERROR"
        return status, back_data

    def anticoll(self):
        ser_num = []
        self._write(self.BitFramingReg, 0x00)
        (status, back_data, back_bits) = self._to_card(self.PCD_TRANSCEIVE, [self.PICC_ANTICOLL, 0x20])
        if status == "OK":
            if len(back_data) == 5:
                checksum = 0
                for i in range(4):
                    checksum ^= back_data[i]
                if checksum != back_data[4]:
                    status = "ERROR"
                else:
                    ser_num = back_data
            else:
                status = "ERROR"
        return status, ser_num

    def read_uid(self):
        status, _ = self.request(self.PICC_REQIDL)
        if status != "OK":
            return None
        status, uid = self.anticoll()
        if status == "OK":
            return uid
        return None
