import sqlite3

def get_db():
    conn = sqlite3.connect("banque.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS accounts (
        rfid_uid TEXT PRIMARY KEY,
        nom TEXT,
        prenom TEXT,
        adresse TEXT,
        solde REAL DEFAULT 0
    )""")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL
    )""")
    conn.commit()
    conn.close()