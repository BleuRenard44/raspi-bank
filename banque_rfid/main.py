from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import AccountCreate, ProductCreate, Recharge, Purchase
from db import get_db, init_db

app = FastAPI()
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre en prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/accounts")
def create_account(account: AccountCreate):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM accounts WHERE rfid_uid = ?", (account.rfid_uid,))
    if cur.fetchone():
        raise HTTPException(400, "Compte déjà existant")
    cur.execute("INSERT INTO accounts (rfid_uid, nom, prenom, adresse) VALUES (?, ?, ?, ?)",
                (account.rfid_uid, account.nom, account.prenom, account.adresse))
    conn.commit()
    return {"status": "Compte créé"}

@app.delete("/accounts/{uid}")
def delete_account(uid: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM accounts WHERE rfid_uid = ?", (uid,))
    conn.commit()
    return {"status": "Compte supprimé"}

@app.post("/accounts/{uid}/recharge")
def recharge_account(uid: str, recharge: Recharge):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE accounts SET solde = solde + ? WHERE rfid_uid = ?", (recharge.montant, uid))
    conn.commit()
    return {"status": "Compte rechargé"}

@app.post("/products")
def create_product(product: ProductCreate):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO products (name, price) VALUES (?, ?)", (product.name, product.price))
    conn.commit()
    return {"status": "Produit créé"}

@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    return {"status": "Produit supprimé"}

@app.get("/products")
def list_products():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products")
    return cur.fetchall()

@app.post("/purchase")
def purchase(purchase: Purchase):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT solde FROM accounts WHERE rfid_uid = ?", (purchase.rfid_uid,))
    account = cur.fetchone()
    if not account:
        raise HTTPException(404, "Compte non trouvé")
    cur.execute("SELECT price FROM products WHERE id = ?", (purchase.product_id,))
    product = cur.fetchone()
    if not product:
        raise HTTPException(404, "Produit non trouvé")
    if account["solde"] < product["price"]:
        raise HTTPException(400, "Solde insuffisant")
    cur.execute("UPDATE accounts SET solde = solde - ? WHERE rfid_uid = ?", (product["price"], purchase.rfid_uid))
    conn.commit()
    return {"status": "Achat effectué"}