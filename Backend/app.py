from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from database import init_db, seed_db
from services.recovery_service import RecoveryService
from services.payment_service import PaymentService
from agents.recovery_agent import RecoveryAgent
from config import Config

load_dotenv()
app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

init_db()
seed_db()

payment_service = PaymentService()
recovery_service = RecoveryService(payment_service)
agent = RecoveryAgent(recovery_service)

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "RecoverAI backend"})

@app.get("/api/dashboard")
def dashboard():
    return jsonify(recovery_service.dashboard())

@app.get("/api/transactions")
def transactions():
    return jsonify(recovery_service.list_transactions(
        query=request.args.get("q", ""),
        status=request.args.get("status", "")
    ))

@app.get("/api/recovery-queue")
def recovery_queue():
    return jsonify(recovery_service.recovery_queue(
        risk=request.args.get("risk", ""),
        action=request.args.get("action", "")
    ))

@app.get("/api/audit")
def audit():
    return jsonify(recovery_service.audit_logs())

@app.post("/api/agent/run")
def run_agent():
    return jsonify(agent.run())

@app.post("/api/recovery/<transaction_id>/execute")
def execute_recovery(transaction_id):
    result = agent.execute_case(transaction_id)
    return jsonify(result), (200 if result.get("success") else 400)

@app.post("/api/simulate-payment")
def simulate_payment():
    return jsonify(recovery_service.simulate_payment(request.get_json(silent=True) or {})), 201

@app.post("/api/audit/clear")
def clear_audit():
    recovery_service.clear_audit()
    return jsonify({"success": True, "message": "Demo audit events cleared."})

@app.errorhandler(404)
def not_found(_):
    return jsonify({"success": False, "error": "Endpoint not found"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
