from fastapi import APIRouter
from db import get_db
from models import Purchase

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