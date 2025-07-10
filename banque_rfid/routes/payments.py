from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db

router = APIRouter()

class PurchaseRequest(BaseModel):
    rfid_uid: str
    product_ids: List[int]

@router.post("/purchase")
def purchase(data: PurchaseRequest):
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cur = conn.cursor()

    # Vérifier l'existence de l'utilisateur et son solde
    cur.execute("SELECT solde FROM accounts WHERE rfid_uid = ?", (data.rfid_uid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    solde = row["solde"]

    # Récupérer les prix des produits demandés
    placeholder = ",".join("?" for _ in data.product_ids)
    cur.execute(f"SELECT id, price FROM products WHERE id IN ({placeholder})", tuple(data.product_ids))
    products = cur.fetchall()

    if len(products) != len(data.product_ids):
        raise HTTPException(status_code=404, detail="One or more products not found")

    total_price = sum(prod["price"] for prod in products)

    if solde < total_price:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    # Déduire le total du solde
    cur.execute("UPDATE accounts SET solde = solde - ? WHERE rfid_uid = ?", (total_price, data.rfid_uid))
    conn.commit()

    return {
        "status": "purchase complete",
        "total_price": total_price,
        "products_bought": [prod["id"] for prod in products],
    }
