import sqlite3
from datetime import datetime
from config import Config

def get_connection():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, customer TEXT NOT NULL, email TEXT, amount REAL NOT NULL,
        event TEXT NOT NULL, reason TEXT, risk TEXT, action TEXT, confidence REAL,
        status TEXT DEFAULT 'pending', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT,
        event TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL
    );
    """)
    conn.commit()
    conn.close()

def seed_db():
    conn = get_connection()
    if conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]:
        conn.close()
        return
    rows = [
        ("RP-78241","Arjun Mehta","arjun@acme.in",8999,"Payment failed","Bank decline","high","Retry payment",.94,"pending"),
        ("RP-78238","Neha Sharma","neha@pixel.in",2499,"Checkout abandoned","Checkout drop-off","medium","Send payment link",.91,"pending"),
        ("RP-78221","Rahul Verma","rahul@nova.in",18200,"Payment failed","Repeated decline","high","Escalate to human",.88,"pending"),
        ("RP-78194","Priya Singh","priya@orbit.in",1299,"Subscription failed","Expired card","medium","Send update-card link",.96,"recovered"),
        ("RP-78182","Karan Gupta","karan@build.in",7500,"Payment failed","Network timeout","high","Retry payment",.93,"pending"),
        ("RP-78167","Aditi Rao","aditi@flow.in",3999,"Checkout abandoned","Payment page exit","medium","Send reminder",.89,"pending"),
        ("RP-78143","Vivek Nair","vivek@zen.in",11200,"Payment failed","Insufficient funds","high","Retry tomorrow",.87,"failed")
    ]
    now = datetime.now().isoformat(timespec="seconds")
    conn.executemany("""INSERT INTO transactions
    (id,customer,email,amount,event,reason,risk,action,confidence,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)""", [r+(now,) for r in rows])
    conn.commit()
    conn.close()

def query_all(sql, params=()):
    conn=get_connection(); rows=conn.execute(sql,params).fetchall(); conn.close()
    return [dict(r) for r in rows]

def query_one(sql, params=()):
    conn=get_connection(); row=conn.execute(sql,params).fetchone(); conn.close()
    return dict(row) if row else None

def execute(sql, params=()):
    conn=get_connection(); cur=conn.execute(sql,params); conn.commit()
    value=cur.lastrowid; conn.close(); return value
