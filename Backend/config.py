import os

class Config:
    DATABASE_PATH = os.getenv("DATABASE_PATH", "recoverai.db")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    SECRET_KEY = os.getenv("SECRET_KEY", "recoverai-demo-secret")
    RECOVERY_MAX_AUTONOMOUS_AMOUNT = float(os.getenv("RECOVERY_MAX_AUTONOMOUS_AMOUNT", "10000"))
    LOW_CONFIDENCE_THRESHOLD = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.80"))
