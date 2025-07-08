from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import accounts, products, payments

app = FastAPI()

# Autoriser les requêtes venant de localhost:3000 (ton frontend React)
origins = [
    "http://localhost:3000",
    # tu peux ajouter d'autres origines si besoin
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # autorise ces origines
    allow_credentials=True,
    allow_methods=["*"],    # autorise tous les verbes HTTP (GET, POST, etc)
    allow_headers=["*"],    # autorise tous les headers
)

app.include_router(accounts.router)
app.include_router(products.router)
app.include_router(payments.router)