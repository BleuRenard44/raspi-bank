from fastapi import APIRouter, HTTPException
from db import get_db
from models import AccountCreate, Recharge, Purchase

router = APIRouter(prefix="/accounts")

@router.post("/")
def create_account(account: AccountCreate):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM accounts WHERE rfid_uid = ?", (account.rfid_uid,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Account with this RFID UID already exists")
    cur.execute(
        "INSERT INTO accounts (nom, prenom, adresse, rfid_uid, solde) VALUES (?, ?, ?, ?, ?)",
        (account.nom, account.prenom, account.adresse, account.rfid_uid, 0.0)
    )
    conn.commit()
    return {"status": "created"}

@router.post("/{rfid_uid}/recharge")
def recharge(rfid_uid: str, data: Recharge):
    if data.montant <= 0:
        raise HTTPException(status_code=400, detail="Montant doit être positif")

    conn = get_db()
    cur = conn.cursor()

    # Vérifier existence et récupérer solde actuel
    cur.execute("SELECT solde FROM accounts WHERE rfid_uid = ?", (rfid_uid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Account not found")

    solde_actuel = row[0]

    # Mettre à jour le solde
    nouveau_solde = solde_actuel + data.montant
    cur.execute("UPDATE accounts SET solde = ? WHERE rfid_uid = ?", (nouveau_solde, rfid_uid))
    conn.commit()

    return {"status": "recharged", "nouveau_solde": nouveau_solde}


@router.post("/{rfid_uid}/buy")
def buy(rfid_uid: str, purchase: Purchase):
    conn = get_db()
    cur = conn.cursor()
    # Récupérer solde compte
    cur.execute("SELECT solde FROM accounts WHERE rfid_uid = ?", (rfid_uid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Account not found")
    solde = row[0]  # index 0, car tuple
    # Récupérer prix produit
    cur.execute("SELECT price FROM products WHERE id = ?", (purchase.product_id,))
    prod = cur.fetchone()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    price = prod[0]
    # Vérifier fonds suffisants
    if solde < price:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    # Débiter solde
    cur.execute("UPDATE accounts SET solde = solde - ? WHERE rfid_uid = ?", (price, rfid_uid))
    conn.commit()
    return {"status": "purchase complete"}

@router.delete("/{rfid_uid}")
def delete_account(rfid_uid: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM accounts WHERE rfid_uid = ?", (rfid_uid,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Account not found")
    cur.execute("DELETE FROM accounts WHERE rfid_uid = ?", (rfid_uid,))
    conn.commit()
    return {"status": "deleted"}
