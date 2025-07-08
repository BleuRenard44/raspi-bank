from pydantic import BaseModel

class AccountCreate(BaseModel):
    rfid_uid: str
    nom: str
    prenom: str
    adresse: str

class ProductCreate(BaseModel):
    name: str
    price: float

class Recharge(BaseModel):
    montant: float

class Purchase(BaseModel):
    rfid_uid: str
    product_id: int