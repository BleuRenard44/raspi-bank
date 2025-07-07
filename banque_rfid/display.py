from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from PIL import ImageDraw, ImageFont, Image

serial = i2c(port=1, address=0x3C)
device = ssd1306(serial)

font = ImageFont.load_default()

def show_message(text):
    image = Image.new("1", device.size)
    draw = ImageDraw.Draw(image)
    draw.text((0, 0), text, font=font, fill=255)
    device.display(image)