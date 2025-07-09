from pydantic import BaseModel

class AccountCreate(BaseModel):
    nom: str
    prenom: str
    adresse: str
    rfid_uid: str

class Recharge(BaseModel):
    montant: float

class Purchase(BaseModel):
    product_id: int

class ProductCreate(BaseModel):
    name: str
    price: float
