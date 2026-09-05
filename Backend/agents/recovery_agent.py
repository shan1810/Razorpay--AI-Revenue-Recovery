from config import Config

class RecoveryAgent:
    ALLOWED_ACTIONS={"Retry payment","Retry tomorrow","Send payment link","Send reminder",
                     "Send update-card link","Escalate to human"}

    def __init__(self,service): self.service=service

    def decide(self,case):
        amount=float(case["amount"]); reason=(case.get("reason") or "").lower()
        confidence=float(case.get("confidence") or 0)
        if amount>Config.RECOVERY_MAX_AUTONOMOUS_AMOUNT:
            action="Escalate to human"; why="Amount exceeds autonomous recovery limit."
        elif confidence<Config.LOW_CONFIDENCE_THRESHOLD:
            action="Escalate to human"; why="Confidence is below the autonomous threshold."
        elif "expired" in reason:
            action="Send update-card link"; why="Expired payment credential requires customer update."
        elif any(x in reason for x in ["abandon","drop-off","exit"]):
            action="Send payment link"; why="Checkout abandonment is suited to a fresh payment link."
        elif "network" in reason:
            action="Retry payment"; why="Transient network failure is suitable for a bounded retry."
        elif "insufficient" in reason:
            action="Retry tomorrow"; why="Immediate retry may fail again; use a later retry."
        elif "decline" in reason:
            action="Retry payment"; why="A single bounded retry is allowed for this failure class."
        else:
            action="Escalate to human"; why="Failure cause is outside autonomous policy."
        return {"transaction_id":case["id"],"action":action,
                "confidence":round(confidence,2),"rationale":why}

    def run(self):
        queue=self.service.recovery_queue()
        return {"success":True,"message":"Agent scan completed.",
                "cases_analyzed":len(queue),"decisions":[self.decide(x) for x in queue]}

    def execute_case(self,tid):
        case=self.service.get_transaction(tid)
        if not case: return {"success":False,"error":"Transaction not found."}
        decision=self.decide(case)
        if decision["action"] not in self.ALLOWED_ACTIONS:
            return {"success":False,"error":"Action blocked by policy."}
        return {**self.service.execute_action(tid,decision["action"],decision["rationale"]),
                "decision":decision}
