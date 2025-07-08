from fastapi import APIRouter, Body
from db import get_db
from models import Purchase
import lgpio as GPIO
from rfid import read_uid

router = APIRouter()

@router.post("/purchase")
def purchase(p: Purchase):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT solde FROM accounts WHERE rfid_uid = ?", (p.rfid_uid,))
    row = cur.fetchone()
    if not row:
        return {"error": "User not found"}
    cur.execute("SELECT price FROM products WHERE id = ?", (p.product_id,))
    prod = cur.fetchone()
    if not prod:
        return {"error": "Product not found"}
    if row["solde"] < prod["price"]:
        return {"error": "Insufficient funds"}
    cur.execute("UPDATE accounts SET solde = solde - ? WHERE rfid_uid = ?", (prod["price"], p.rfid_uid))
    conn.commit()
    return {"status": "purchase complete"}

@router.get("/rfid/read")
def read_rfid():
    """
    Attend et lit une carte RFID.
    Retourne l'UID et le texte stocké sur la carte.
    """
    try:
        uid = read_uid()
        return {"status": "success", "uid": uid}
    except Exception as e:
        return {"error": str(e)}
    finally:
        GPIO.cleanup()

@router.post("/rfid/write")
def write_rfid(message: str = Body(..., embed=True)):
    """
    Attend une carte RFID et écrit le message fourni dessus.
    """
    try:
        reader.write(message)
        return {"status": "Message written successfully"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        GPIO.cleanup()