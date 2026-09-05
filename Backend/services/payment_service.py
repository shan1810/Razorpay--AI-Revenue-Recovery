import random

class PaymentService:
    # Demo provider. Replace these methods with Razorpay test-mode calls later.
    def retry_payment(self, t):
        reason=(t.get("reason") or "").lower()
        amount=float(t["amount"])
        success = ("network" in reason) or ("decline" in reason and amount <= 10000)
        if "network" not in reason and "decline" not in reason:
            success = random.random() >= .35
        return {"success":success,"provider":"MockRazorpay","operation":"retry_payment",
                "payment_id":"pay_demo_"+t["id"].lower(),
                "message":"Payment captured successfully." if success else "Payment retry failed."}

    def send_payment_link(self,t):
        return {"success":True,"provider":"MockRazorpay","operation":"send_payment_link",
                "link_id":"plink_demo_"+t["id"].lower(),"message":"Payment link generated and sent."}

    def send_reminder(self,t):
        return {"success":True,"provider":"MockNotification","operation":"send_reminder",
                "message":"Recovery reminder sent to the customer."}

    def send_update_card_link(self,t):
        return {"success":True,"provider":"MockRazorpay","operation":"update_card_link",
                "link_id":"update_demo_"+t["id"].lower(),"message":"Update-payment-method link sent."}

    def escalate(self,t):
        return {"success":True,"provider":"MockSupport","operation":"escalate_to_human",
                "message":"Case added to human review queue."}

    def execute(self,action,t):
        handlers={"Retry payment":self.retry_payment,"Retry tomorrow":self.send_reminder,
                  "Send payment link":self.send_payment_link,"Send reminder":self.send_reminder,
                  "Send update-card link":self.send_update_card_link,"Escalate to human":self.escalate}
        return handlers.get(action,lambda _:{"success":False,"message":"Unsupported payment action."})(t)
