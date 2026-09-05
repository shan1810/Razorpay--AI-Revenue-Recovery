from datetime import datetime
import random
from database import query_all, query_one, execute

class RecoveryService:
    def __init__(self,payment_service): self.payment_service=payment_service

    def get_transaction(self,tid):
        return query_one("SELECT * FROM transactions WHERE id=?",(tid,))

    def list_transactions(self,query="",status=""):
        sql="SELECT * FROM transactions WHERE 1=1"; params=[]
        if query:
            sql+=" AND (LOWER(customer) LIKE ? OR LOWER(id) LIKE ? OR LOWER(event) LIKE ?)"
            q="%"+query.lower()+"%"; params += [q,q,q]
        if status: sql+=" AND status=?"; params.append(status)
        return query_all(sql+" ORDER BY created_at DESC",params)

    def recovery_queue(self,risk="",action=""):
        sql="SELECT * FROM transactions WHERE status!='recovered'"; params=[]
        if risk: sql+=" AND risk=?"; params.append(risk)
        if action: sql+=" AND LOWER(action) LIKE ?"; params.append("%"+action.lower()+"%")
        sql+=" ORDER BY CASE risk WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, amount DESC"
        return query_all(sql,params)

    def audit_logs(self):
        return query_all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")

    def add_audit(self,tid,event,details):
        execute("INSERT INTO audit_logs(transaction_id,event,details,created_at) VALUES(?,?,?,?)",
                (tid,event,details,datetime.now().isoformat(timespec="seconds")))

    def execute_action(self,tid,action,rationale):
        t=self.get_transaction(tid)
        if not t: return {"success":False,"error":"Transaction not found."}
        self.add_audit(tid,"Selected "+action,rationale)
        result=self.payment_service.execute(action,t)
        if result["success"]:
            status="pending" if action=="Escalate to human" else "recovered"
            execute("UPDATE transactions SET status=?,action=? WHERE id=?",(status,action,tid))
            detail="Recovered ₹{:,.0f}".format(t["amount"]) if status=="recovered" else result["message"]
            self.add_audit(tid,"Action verified",detail)
            return {"success":True,"status":status,"transaction_id":tid,"amount":t["amount"],
                    "provider_result":result,"message":result["message"]}
        execute("UPDATE transactions SET status='failed' WHERE id=?",(tid,))
        self.add_audit(tid,"Action failed",result["message"])
        return {"success":False,"status":"failed","transaction_id":tid,"amount":t["amount"],
                "provider_result":result,"message":result["message"]}

    def dashboard(self):
        rows=query_all("SELECT * FROM transactions")
        risk=sum(float(r["amount"]) for r in rows if r["status"]!="recovered")
        recovered=sum(float(r["amount"]) for r in rows if r["status"]=="recovered")
        total=recovered+risk
        return {"revenue_at_risk":round(risk,2),"revenue_recovered":round(recovered,2),
                "recovery_rate":round(recovered/total*100,1) if total else 0,
                "cases_processed":len(rows),
                "pending_cases":sum(r["status"]=="pending" for r in rows),
                "failed_cases":sum(r["status"]=="failed" for r in rows)}

    def simulate_payment(self,payload):
        tid="RP-"+str(random.randint(78300,78999))
        amount=float(payload.get("amount",2499)); reason=payload.get("reason","Bank decline")
        abandoned="abandon" in reason.lower()
        event="Checkout abandoned" if abandoned else "Payment failed"
        action="Send payment link" if abandoned else "Retry payment"
        risk="medium" if abandoned else "high"; confidence=.91 if abandoned else .92
        now=datetime.now().isoformat(timespec="seconds")
        execute("""INSERT INTO transactions
        (id,customer,email,amount,event,reason,risk,action,confidence,status,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,'pending',?)""",
        (tid,payload.get("customer","Demo Customer"),payload.get("email","demo@example.in"),
         amount,event,reason,risk,action,confidence,now))
        self.add_audit(tid,"Detected simulated payment event","₹{:,.0f} at risk".format(amount))
        return {"success":True,"transaction":self.get_transaction(tid)}

    def clear_audit(self): execute("DELETE FROM audit_logs")
