# RecoverAI Backend

Flask backend for Razorpay Buildathon Track 03 — AI Revenue Recovery.

Workflow:
Detect revenue at risk -> Diagnose -> Choose bounded intervention -> Execute -> Verify -> Audit.

This is a demo: payment actions are simulated and do not move real money.

## Setup in VS Code

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Optional Gemini:
```bash
copy .env.example .env
```
Then add your `GEMINI_API_KEY`. The core agent works without Gemini.

Start:
```bash
python app.py
```

Backend: `http://127.0.0.1:5000`

## API

- GET `/api/health`
- GET `/api/dashboard`
- GET `/api/transactions`
- GET `/api/recovery-queue`
- GET `/api/audit`
- POST `/api/agent/run`
- POST `/api/recovery/<transaction_id>/execute`
- POST `/api/simulate-payment`
- POST `/api/audit/clear`

## Architecture

Browser -> Flask API -> Recovery Agent -> Recovery Service -> Mock Payment Service
                                             -> SQLite
                                             -> Audit Trail

The agent has an explicit allow-list, amount limit, confidence threshold and human escalation.
Replace `services/payment_service.py` with authenticated Razorpay test-mode calls when integrating real APIs.
