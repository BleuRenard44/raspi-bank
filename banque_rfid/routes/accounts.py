from fastapi import APIRouter, HTTPException
from db import get_db
from models import AccountCreate, Recharge

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

@router.post("/{uid}/recharge")
def recharge(uid: str, data: Recharge):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM accounts WHERE rfid_uid = ?", (uid,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Account not found")
    cur.execute("UPDATE accounts SET solde = solde + ? WHERE rfid_uid = ?", (data.montant, uid))
    conn.commit()
    return {"status": "recharged"}

@router.delete("/{uid}")
def delete_account(uid: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM accounts WHERE rfid_uid = ?", (uid,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Account not found")
    cur.execute("DELETE FROM accounts WHERE rfid_uid = ?", (uid,))
    conn.commit()
    return {"status": "deleted"}