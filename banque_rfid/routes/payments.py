from fastapi import APIRouter, Body
from db import get_db
from models import Purchase
import lgpio as GPIO
from rfid import read_uid, reader

router = APIRouter()

@router.get("/scan_uid")
def scan_uid():
    try:
        uid = read_uid()
        if uid is None:
            return {"error": "No card detected"}
        return {"uid": uid}
    except Exception as e:
        return {"error": str(e)}
    finally:
        GPIO.cleanup()

@router.post("/write_card")
def write_card(data: dict = Body(...)):
    """
    Route appelée par le frontend pour écrire des infos sur la carte RFID.
    On reçoit un JSON avec rfid_uid, nom, prenom, solde, banque.
    On formate un message texte à écrire sur la carte.
    """
    try:
        # Exemple de formatage du message à écrire sur la carte
        message = f"UID:{data.get('rfid_uid','')};NOM:{data.get('nom','')};PRENOM:{data.get('prenom','')};SOLDE:{data.get('solde',0)};BANQUE:{data.get('banque','')}"
        reader.write(message)
        return {"status": "Message written successfully"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        GPIO.cleanup()

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