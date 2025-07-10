from fastapi import APIRouter, HTTPException
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
    cur.execute("SELECT id, name, price FROM products")
    rows = cur.fetchall()
    return [{"id": r[0], "name": r[1], "price": r[2]} for r in rows]

@router.delete("/{product_id}")
def delete_product(product_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Product not found")
    cur.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    return {"status": "deleted"}
