from fastapi import APIRouter
from db import get_db
from models import ProductCreate

router = APIRouter(prefix="/products")

@router.post("/")
def create_product(prod: ProductCreate):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO products (name, price) VALUES (?, ?)", (prod.name, prod.price))
    conn.commit()
    return {"status": "created"}

@router.get("/")
def list_products():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products")
    return cur.fetchall()