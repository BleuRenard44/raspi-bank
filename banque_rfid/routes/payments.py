from fastapi import APIRouter, HTTPException
from db import get_db
from models import Purchase

router = APIRouter()

@router.post("/purchase")
def purchase(p: Purchase):
    conn = get_db()
    # Utilisation de row_factory pour accéder aux colonnes par nom
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cur = conn.cursor()

    cur.execute("SELECT solde FROM accounts WHERE rfid_uid = ?", (p.rfid_uid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    cur.execute("SELECT price FROM products WHERE id = ?", (p.product_id,))
    prod = cur.fetchone()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if row["solde"] < prod["price"]:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    cur.execute("UPDATE accounts SET solde = solde - ? WHERE rfid_uid = ?", (prod["price"], p.rfid_uid))
    conn.commit()
    return {"status": "purchase complete"}
