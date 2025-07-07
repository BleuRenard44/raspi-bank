from fastapi import APIRouter
from db import get_db
from models import AccountCreate, Recharge

router = APIRouter(prefix="/accounts")

@router.post("/")
def create_account(account: AccountCreate):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO accounts (nom, prenom, adresse, rfid_uid, solde) VALUES (?, ?, ?, ?, ?)",
                (account.nom, account.prenom, account.adresse, account.rfid_uid, 0.0))
    conn.commit()
    return {"status": "created"}

@router.post("/{uid}/recharge")
def recharge(uid: str, data: Recharge):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE accounts SET solde = solde + ? WHERE rfid_uid = ?", (data.montant, uid))
    conn.commit()
    return {"status": "recharged"}