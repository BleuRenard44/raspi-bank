from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import accounts, products, payments

app = FastAPI()

origins = [
    "http://localhost:3000",
    # ajoute ici l'URL de ton frontend si différente
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(products.router)
app.include_router(payments.router)