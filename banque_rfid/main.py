from fastapi import FastAPI
from routes import accounts, products, payments

app = FastAPI()

app.include_router(accounts.router)
app.include_router(products.router)
app.include_router(payments.router)