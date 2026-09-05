// RecoverAI Frontend <-> Flask Backend Integration
// Backend URL: http://127.0.0.1:5000

const API_BASE = "http://127.0.0.1:5000/api";

// Fallback data keeps the UI usable if the Flask server is temporarily offline.
let transactions = [
  {id:"RP-78241",customer:"Arjun Mehta",email:"arjun@acme.in",amount:8999,event:"Payment failed",reason:"Bank decline",risk:"high",action:"Retry payment",confidence:94,status:"pending",time:"2 min ago"},
  {id:"RP-78238",customer:"Neha Sharma",email:"neha@pixel.in",amount:2499,event:"Checkout abandoned",reason:"Checkout drop-off",risk:"medium",action:"Send payment link",confidence:91,status:"pending",time:"8 min ago"},
  {id:"RP-78221",customer:"Rahul Verma",email:"rahul@nova.in",amount:18200,event:"Payment failed",reason:"Repeated decline",risk:"high",action:"Escalate to human",confidence:88,status:"pending",time:"16 min ago"},
  {id:"RP-78194",customer:"Priya Singh",email:"priya@orbit.in",amount:1299,event:"Subscription failed",reason:"Expired card",risk:"medium",action:"Send update-card link",confidence:96,status:"recovered",time:"24 min ago"},
  {id:"RP-78182",customer:"Karan Gupta",email:"karan@build.in",amount:7500,event:"Payment failed",reason:"Network timeout",risk:"high",action:"Retry payment",confidence:93,status:"pending",time:"31 min ago"},
  {id:"RP-78167",customer:"Aditi Rao",email:"aditi@flow.in",amount:3999,event:"Checkout abandoned",reason:"Payment page exit",risk:"medium",action:"Send reminder",confidence:89,status:"pending",time:"42 min ago"},
  {id:"RP-78143",customer:"Vivek Nair",email:"vivek@zen.in",amount:11200,event:"Payment failed",reason:"Insufficient funds",risk:"high",action:"Retry tomorrow",confidence:87,status:"failed",time:"58 min ago"}
];

let auditEvents = [
  ["12:24:18","RP-78241","Detected payment failure","₹8,999 at risk"],
  ["12:24:19","RP-78241","Diagnosed bank decline","Confidence 94%"],
  ["12:24:20","RP-78241","Selected retry_payment","Within policy"],
  ["12:25:02","RP-78241","Payment verified","Recovered ₹8,999"],
  ["12:18:41","RP-78238","Checkout abandonment detected","₹2,499 at risk"],
  ["12:18:42","RP-78238","Payment link selected","Confidence 91%"]
];

let selectedCase = null;
let activeFilter = "all";
let backendOnline = false;

const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits: 0});
const initials = name => (name || "Demo Customer").split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase();

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function formatTime(value){
  if(!value) return "—";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return value;
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60000);
  if(mins < 1) return "just now";
  if(mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if(hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function normalizeTransaction(t){
  return {
    ...t,
    amount: Number(t.amount || 0),
    confidence: Number(t.confidence || 0) <= 1 ? Number(t.confidence || 0) * 100 : Number(t.confidence || 0),
    time: t.time || formatTime(t.created_at)
  };
}

function customerCell(t){
  return `<div class="customer"><div class="mini-avatar">${escapeHtml(initials(t.customer))}</div><div><strong>${escapeHtml(t.customer)}</strong><span>${escapeHtml(t.id)}</span></div></div>`;
}

function renderQueue(){
  const queue = transactions.filter(t => t.status !== "recovered");
  const rows = queue.slice(0,5).map(t => `
    <tr>
      <td>${customerCell(t)}</td>
      <td class="issue">${escapeHtml(t.reason)}</td>
      <td class="amount">${inr(t.amount)}</td>
      <td>${escapeHtml(t.action)}</td>
      <td><span class="risk ${escapeHtml(t.risk)}">${escapeHtml(t.risk)}</span></td>
      <td><button class="action-link" data-action="${escapeHtml(t.id)}">Review →</button></td>
    </tr>`).join("");
  document.getElementById("queueTable").innerHTML = rows || `<tr><td colspan="6" style="text-align:center;padding:28px">No recovery cases.</td></tr>`;
}

function renderRecovery(){
  let data = [...transactions];
  if(activeFilter === "high") data = data.filter(t=>t.risk === "high");
  if(activeFilter === "medium") data = data.filter(t=>t.risk === "medium");
  if(activeFilter === "retry") data = data.filter(t=>(t.action || "").toLowerCase().includes("retry"));

  document.getElementById("recoveryTable").innerHTML = data.map(t=>`
    <tr>
      <td>${customerCell(t)}</td>
      <td class="issue">${escapeHtml(t.reason)}</td>
      <td class="amount">${inr(t.amount)}</td>
      <td>${escapeHtml(t.action)}</td>
      <td class="confidence">${Math.round(t.confidence)}%</td>
      <td><span class="status ${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
      <td><button class="action-link" data-action="${escapeHtml(t.id)}">${t.status === "recovered" ? "View" : "Execute →"}</button></td>
    </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;padding:28px">No transactions match this filter.</td></tr>`;
}

function renderTransactions(query=""){
  const q = query.toLowerCase().trim();
  const data = transactions.filter(t => !q || `${t.customer} ${t.id} ${t.event} ${t.reason}`.toLowerCase().includes(q));
  document.getElementById("transactionTable").innerHTML = data.map(t=>`
    <tr>
      <td><strong>${escapeHtml(t.id)}</strong></td>
      <td>${escapeHtml(t.customer)}</td>
      <td class="amount">${inr(t.amount)}</td>
      <td>${escapeHtml(t.event)}</td>
      <td>${escapeHtml(t.time || formatTime(t.created_at))}</td>
      <td><span class="status ${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
    </tr>`).join("") || `<tr><td colspan="6" style="text-align:center;padding:28px">No transactions found.</td></tr>`;
}

function renderAudit(){
  document.getElementById("auditList").innerHTML = auditEvents.map(e=>`
    <div class="audit-entry">
      <div class="audit-time">${escapeHtml(e[0])}</div>
      <div><strong>${escapeHtml(e[1])} · ${escapeHtml(e[2])}</strong><span>${escapeHtml(e[3])}</span></div>
      <div class="audit-action">verified log</div>
    </div>`).join("") || `<div style="padding:30px;text-align:center;color:#9d968e">No audit events.</div>`;
}

function showToast(title,text){
  const titleEl = document.getElementById("toastTitle");
  const textEl = document.getElementById("toastText");
  if(titleEl) titleEl.textContent = title;
  if(textEl) textEl.textContent = text;
  const toast=document.getElementById("toast");
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>toast.classList.remove("show"),3500);
}

async function api(path, options={}){
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {"Content-Type":"application/json", ...(options.headers || {})}
  });
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if(!response.ok){
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }
  return data;
}

function setConnectionStatus(online){
  backendOnline = online;
  const labels = document.querySelectorAll(".pulse-label");
  labels.forEach(label => {
    label.innerHTML = online ? "<i></i> Live" : "<i></i> Offline";
  });

  const liveText = document.querySelector(".live-status");
  if(liveText) liveText.textContent = online ? "Live" : "Offline";
}

function updateDashboardMetrics(data){
  if(!data) return;
  const risk = document.getElementById("riskValue");
  const recovered = document.getElementById("recoveredValue");
  const cases = document.getElementById("casesValue");
  if(risk) risk.textContent = inr(data.revenue_at_risk);
  if(recovered) recovered.textContent = inr(data.revenue_recovered);
  if(cases) cases.textContent = Number(data.cases_processed || 0).toLocaleString("en-IN");

  const recoveredCard = recovered?.closest(".metric-card");
  if(recoveredCard){
    const small = recoveredCard.querySelector(".metric-foot");
    if(small) small.textContent = `${data.recovery_rate || 0}% recovery rate`;
  }
}

async function loadDashboard(){
  const data = await api("/dashboard");
  updateDashboardMetrics(data);
  return data;
}

async function loadTransactions(){
  const data = await api("/transactions");
  transactions = (Array.isArray(data) ? data : []).map(normalizeTransaction);
  renderQueue();
  renderRecovery();
  renderTransactions(document.getElementById("transactionSearch")?.value || "");
}

async function loadQueue(){
  const data = await api("/recovery-queue");
  // Keep all transactions loaded separately; queue endpoint is used for ordering.
  const queueIds = new Set((data || []).map(t => t.id));
  transactions.sort((a,b) => {
    const ai = queueIds.has(a.id) ? 0 : 1;
    const bi = queueIds.has(b.id) ? 0 : 1;
    return ai - bi;
  });
  renderQueue();
}

async function loadAudit(){
  const data = await api("/audit");
  auditEvents = (data || []).map(e => [
    e.created_at ? new Date(e.created_at).toLocaleTimeString("en-IN", {hour12:false}) : "—",
    e.transaction_id || "SYSTEM",
    e.event || "Event",
    e.details || ""
  ]);
  renderAudit();
}

async function refreshFromBackend(showError=false){
  try{
    await loadDashboard();
    await loadTransactions();
    await loadQueue();
    await loadAudit();
    setConnectionStatus(true);
    return true;
  }catch(error){
    setConnectionStatus(false);
    if(showError) showToast("Backend unavailable", "Make sure python app.py is running on port 5000.");
    return false;
  }
}

function openAction(id){
  const t=transactions.find(x=>x.id===id);
  if(!t) return;
  selectedCase=t;
  document.getElementById("modalTitle").textContent=t.action || "Run recovery action";
  document.getElementById("modalDescription").textContent=`RecoverAI recommends this action with ${Math.round(t.confidence)}% confidence. The action is bounded by the current recovery policy.`;
  document.getElementById("modalCase").innerHTML=`
    <div class="customer">${customerCell(t)}</div>
    <div style="margin-top:12px;color:#9d968e;font-size:10px">
      Reason: <b style="color:#e2ddd5">${escapeHtml(t.reason)}</b> · Amount at risk: <b style="color:#e2ddd5">${inr(t.amount)}</b>
    </div>`;
  document.getElementById("modal").classList.add("open");
}

function closeModal(){
  document.getElementById("modal").classList.remove("open");
  selectedCase=null;
}

async function executeAction(){
  if(!selectedCase) return;
  const t=selectedCase;
  const confirmBtn=document.getElementById("confirmAction");
  const originalText=confirmBtn.textContent;
  confirmBtn.disabled=true;
  confirmBtn.textContent="Executing...";

  try{
    const result = await api(`/recovery/${encodeURIComponent(t.id)}/execute`, {method:"POST", body:JSON.stringify({})});
    closeModal();
    await refreshFromBackend(false);
    showToast(result.success ? "Recovery successful" : "Recovery failed", result.message || `${inr(t.amount)} processed.`);
  }catch(error){
    showToast("Recovery failed", error.message);
  }finally{
    confirmBtn.disabled=false;
    confirmBtn.textContent=originalText;
  }
}

function switchView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const target=document.getElementById(view+"View");
  if(target) target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===view));
  const titles={overview:"Overview",recovery:"Recovery Queue",transactions:"Transactions",agent:"AI Agent",audit:"Audit Trail"};
  document.getElementById("pageTitle").textContent=titles[view] || "Overview";
  window.scrollTo({top:0,behavior:"smooth"});
}

async function runAgent(){
  const list=document.getElementById("activityList");
  const runButtons=[document.getElementById("runAgentBtn"),document.getElementById("agentRunLarge")].filter(Boolean);
  runButtons.forEach(btn=>{btn.disabled=true; btn.dataset.originalText=btn.textContent; btn.textContent="Running...";});

  try{
    const result=await api("/agent/run", {method:"POST", body:JSON.stringify({})});
    const decisions=result.decisions || [];
    const item=document.createElement("div");
    item.className="activity-item";
    item.innerHTML=`<span class="activity-icon action">✦</span><div><strong>Agent scan completed</strong><span>${result.cases_analyzed || decisions.length} cases analyzed · ${decisions.length} decisions generated</span></div><time>now</time>`;
    list.prepend(item);
    document.querySelectorAll(".pulse-label").forEach(x=>x.innerHTML="<i></i> Completed");
    await refreshFromBackend(false);
    showToast("Agent run complete",`${result.cases_analyzed || decisions.length} cases analyzed and ranked by recovery policy.`);
  }catch(error){
    showToast("Agent run failed", error.message || "Could not reach the Flask backend.");
  }finally{
    runButtons.forEach(btn=>{btn.disabled=false; btn.textContent=btn.dataset.originalText || "✦ Run recovery agent";});
  }
}

async function simulatePayment(){
  try{
    const result=await api("/simulate-payment", {
      method:"POST",
      body:JSON.stringify({
        customer:"Demo Customer",
        email:"demo@example.in",
        amount:2499,
        reason:"Bank decline"
      })
    });
    await refreshFromBackend(false);
    const t=normalizeTransaction(result.transaction);
    showToast("Payment event simulated",`${inr(t.amount)} added to the recovery queue.`);
  }catch(error){
    showToast("Simulation failed",error.message || "Could not reach the Flask backend.");
  }
}

function exportReport(){
  const header=["Order","Customer","Email","Amount","Event","Reason","Risk","Action","Confidence","Status","Created"];
  const rows=transactions.map(t=>[
    t.id,t.customer,t.email,t.amount,t.event,t.reason,t.risk,t.action,`${Math.round(t.confidence)}%`,t.status,t.created_at || t.time
  ]);
  const csv=[header,...rows].map(row=>row.map(value=>`"${String(value ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`recoverai-report-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast("Report exported","A CSV report was generated from the current transaction data.");
}

async function clearAudit(){
  if(!backendOnline){
    auditEvents=[]; renderAudit(); showToast("Audit cleared","Local demo events were removed."); return;
  }
  try{
    await api("/audit/clear",{method:"POST",body:JSON.stringify({})});
    await loadAudit();
    showToast("Audit cleared","Demo audit events were removed from the backend.");
  }catch(error){ showToast("Could not clear audit",error.message); }
}

// Event bindings

document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
document.querySelectorAll("[data-view-target]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.viewTarget)));

document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-action]");
  if(btn) openAction(btn.dataset.action);
});

document.querySelectorAll(".filter").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  activeFilter=btn.dataset.filter;
  renderRecovery();
}));

document.getElementById("transactionSearch").addEventListener("input",e=>renderTransactions(e.target.value));
document.getElementById("modalClose").onclick=closeModal;
document.getElementById("cancelAction").onclick=closeModal;
document.getElementById("confirmAction").onclick=executeAction;
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
document.getElementById("runAgentBtn").onclick=runAgent;
document.getElementById("agentRunLarge").onclick=runAgent;
document.getElementById("simulateBtn").onclick=simulatePayment;
document.getElementById("notificationBtn").onclick=()=>showToast("No new alerts","All critical recovery cases are being monitored.");
document.getElementById("settingsBtn").onclick=()=>showToast("Demo settings","Guardrails are enabled for this prototype.");
document.getElementById("exportBtn").onclick=exportReport;
document.getElementById("clearAuditBtn").onclick=clearAudit;

// Initial render, then immediately replace mock values with backend data.
renderQueue();
renderRecovery();
renderTransactions();
renderAudit();

const dots=[["5%","72%"],["23%","52%"],["44%","39%"],["67%","27%"],["90%","9%"]];
const chartDots=document.getElementById("chartDots");
if(chartDots){
  chartDots.innerHTML=dots.map(d=>`<circle cx="${d[0]}" cy="${d[1]}" r="4" fill="#0d0c0b" stroke="#e6a83a" stroke-width="2"></circle>`).join("");
}

// Connect to Flask as soon as the page loads.
refreshFromBackend(true);

// Refresh backend data periodically so changes made from another tab are reflected.
setInterval(()=>refreshFromBackend(false),15000);
