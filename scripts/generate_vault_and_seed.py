#!/usr/bin/env python3
"""ALKAHTANI OS vault+seed generator (Deliverable D, bug-fixed).
Run: python3 scripts/generate_vault_and_seed.py && psql "$DATABASE_URL" -f seed.sql
Emits 35 agent identity files (vault/agents/*.md) + seed.sql with the exact
reference state: 114 graph nodes (6 depts + 1 nexus + 35 agents + 40 tools +
32 notes), 22 connectors (18 live), pipeline/funnel/tasks matching the dashboard."""
import json, uuid
from pathlib import Path

NS = uuid.UUID("1d4b9c2a-8f3e-4a6d-9c1b-0a5e4f6d7c8b")
uid = lambda n: str(uuid.uuid5(NS, n))
q  = lambda s: "null" if s is None else "'" + str(s).replace("'", "''") + "'"
arr= lambda xs: "array[" + ",".join(q(x) for x in xs) + "]" if xs else "array[]::text[]"
J  = lambda x: q(json.dumps(x, ensure_ascii=False))

CREWS = {"sales":("Sales","#FF7A2F"),"finances":("Finances","#2EE06E"),
 "clients":("Clients","#22D3EE"),"marketing":("Marketing/Growth","#A3E635"),
 "tech":("TECH","#D05CFF"),"communications":("Communications","#3F8CFF")}

# slug, name, role, tools, cron
ROSTER = {
 "sales":[("attio-crm","Attio CRM","Books & Pipeline Sync",["attio"],"*/15 * * * *"),
  ("sales-agent","Sales Agent","Books & Pipeline Instance",["attio","gbrain"],"*/30 * * * *"),
  ("stripe-vantage","Stripe Vantage","Payment-linked Reconciler",["stripe","attio"],"*/30 * * * *"),
  ("fanbasis-launchpad","FanBasis Launchpad","Launchpad Offer Runner",["fanbasis"],"0 * * * *"),
  ("nexo-launchpad-cohort","Nexo Launchpad Cohort","Cohort Nurturer",["fanbasis","gmail"],"0 9 * * *"),
  ("vantage-cohort","Vantage Cohort","Vantage Lane Manager",["attio","stripe"],"0 10 * * *")],
 "finances":[("dana-westfield-processor","Dana Westfield Processor","Reconciliation Processor",["stripe","square"],"*/20 * * * *"),
  ("payments-processor","Payments Processor","Stripe/PayPal/Square Matcher",["stripe","paypal","square"],"*/10 * * * *"),
  ("pava-confirm","PAVA Confirm","Payment Confirmer",["pava"],"*/15 * * * *"),
  ("stripe-tracker","Stripe Tracker","Income Tracker",["stripe"],"*/15 * * * *"),
  ("fanbasis-invoicer","FanBasis Invoicer","Invoice Pulse",["fanbasis"],"0 */2 * * *"),
  ("payments-pulse","Payments Pulse","Payout Health Pulse",["whop","stripe"],"0 */4 * * *")],
 "clients":[("client-roster","Client Roster","Roster Keeper",["attio","notion"],"*/30 * * * *"),
  ("onboarding-agent","Onboarding Agent","New Client Onboarding",["notion","slack","gmail"],"0 9 * * 1"),
  ("rae-rinters","Rae Rinters","Client Relationship Owner",["gmail","whatsapp"],"0 12 * * *"),
  ("client-success","Client Success","Active Client Service",["slack","notion"],"0 16 * * *")],
 "marketing":[("manychat-mcp","ManyChat MCP","DM Funnel Automator",["manychat"],"*/15 * * * *"),
  ("rowotion-editor","Rowotion Editor","Short-form Edit Cutter",["whisper","loom"],"0 14 * * *"),
  ("arcade-creative","Arcade Creative","UGC Variant Generator",["arcade"],"0 11 * * *"),
  ("native-suggest","Native Suggest","Hook & Script Suggester",["gbrain"],"0 9 * * *"),
  ("cernio-social","Cernio Social Agent","Cross-platform Publisher",["tiktok","x-social","linkedin"],"0 18 * * *"),
  ("hiperfield-social","Hiperfield Social","Daily Posts Runner",["tiktok","youtube"],"0 18 * * *"),
  ("reela","Reela","Republish & Vision Sync",["youtube","tiktok"],"0 20 * * *")],
 "tech":[("data-agent","Data Agent","G-Brain Analyst",["gbrain"],"0 8 * * *"),
  ("stack-monitor","Stack Monitor","Local Stack Health",["stack"],"*/5 * * * *"),
  ("comms-connector","Comms Connector","Connector Auditor",["comms-feed"],"*/10 * * * *"),
  ("doc-drafter","Doc Drafter","Docs Drafter",["notion","drive"],"0 15 * * *"),
  ("model-auditor","Model Auditor","Model Score Auditor",["ollama"],"0 3 * * *"),
  ("system-synthesizer","System Synthesizer","Query Synthesizer",["gbrain"],"*/30 * * * *")],
 "communications":[("comms-agent","Comms Agent","Unified Composer",["comms-feed","gmail"],"*/30 * * * *"),
  ("slack-worker","Slack Worker","Slack Digest",["slack"],"*/20 * * * *"),
  ("whatsapp-worker","WhatsApp Worker","WhatsApp Maintainer",["whatsapp","waapi"],"*/20 * * * *"),
  ("gmail-sorter","Gmail Sorter","Inbox Triage & Drafts",["gmail"],"*/10 * * * *"),
  ("inbox-triage","Inbox Triage","Cross-channel Prioritizer",["gmail","slack","whatsapp"],"*/30 * * * *")]}

TOOLS = ["attio","fanbasis","gohighlevel","pava","stripe","paypal","square","whop","notion","slack",
 "gmail","whatsapp","manychat","whisper","arcade","hiperfield","zervio","brain-scrape","dropship",
 "zenentropy","openname","tdux","oyasas","reemotion","waapi","comms-feed","stack","calendly","drive",
 "sheets","airtable","hubspot","tiktok","youtube","x-social","linkedin","telegram","discord","zoom","loom"]

NOTES = ["Keep Attio clean","Move sales-call roster","Run discovery & close the vantage lane",
 "Keep the pipeline honest","Close the books on Friday","Quote financing on request","Track Stripe income",
 "Confirm payments automatically","Pulse FanBasis invoices","Watch Processor health","Keep the client roster current",
 "Onboard new clients","Own the client relationship","Service active clients","Automate DM funnel",
 "Generate UGC ad variants","Republish across six platforms","Cut short-form edits","Run the daily posts",
 "Answer queries from G-Brain","Watch the system stack","Audit connections weekly","Draft docs from calls",
 "Score the local model","Compose the unified digest","Digest Slack channels","Handle inquiries fast",
 "Maintain WhatsApp presence","Triage the inbox at 07:00","Standup: 35 agents live","Weekly exec report",
 "Backup & vault hygiene"]

TPL = """---
id: {slug}
name: {name}
crew: {crew}
role: {role}
model: grok-4
reports_to: conductor
tools: [{tools}]
permissions: [read_gbrain, write_tasks, draft_reply]
schedule: "{cron}"
status: shadow
version: 1
---

# MISSION
{role} for the {crew} crew. Keep its source-of-truth tools and the OS database in agreement.

# RULES
## MUST
- Write every change back to the MCP tool AND the OS database in the same run.
- Cite G-Brain notes used in output.
## MUST NOT
- No client-facing sends, pricing changes, or paid calls without Operator approval.
- Never edit another agent's identity file.

# MEMORY
- top-k query: "{crew} {role}" (k=8) · read: /crews/{crew}/*, /notes/standups/*
- write: /crews/{crew}/notes/<date>-{slug}.md

# WORKFLOW
1 Pull deltas via MCP. 2 Reconcile DB. 3 Act or draft. 4 Update tasks/deals. 5 Log output markdown.

# OUTPUT FORMAT
json {{counters, ids_touched[], brief_md, notes_written[]}}

# ESCALATION
- Connector not live -> broadcast to conductor, exit success=false error=connector_down.
- Threshold breach -> open approval."""

vault = Path("vault/agents"); vault.mkdir(parents=True, exist_ok=True)
L = []  # sql lines

# ---- connectors (22: 18 live / 2 degraded / 2 offline) ----
CONN = {c: "live" for c in ["attio","stripe","whop","pava","slack","gmail","whatsapp","manychat",
 "notion","comms-feed","stack","calendly","drive","sheets","hubspot","tiktok","youtube","zoom"]}
CONN.update({"paypal":"degraded","square":"degraded","gohighlevel":"offline","loom":"offline"})
for s,st in CONN.items():
    L.append(f"insert into connectors (id,slug,name,status,latency_ms,last_sync_at) values ('{uid('c:'+s)}',{q(s)},{q(s.replace('-',' ').title())},{q(st)},42,now()-interval '2 minutes');")

# ---- graph: nexus + depts + tools + notes ----
L.append(f"insert into nodes (id,type,label,color) values ('{uid('n:nexus')}','note','Notes','#FF3B3B');")
for c,(lab,col) in CREWS.items():
    L.append(f"insert into nodes (id,type,label,color) values ('{uid('d:'+c)}','dept',{q(lab)},{q(col)});")
    L.append(f"insert into edges (src,dst,kind) values ('{uid('n:nexus')}','{uid('d:'+c)}','feeds');")
for t in TOOLS:
    L.append(f"insert into nodes (id,type,label,color) values ('{uid('t:'+t)}','tool',{q(t.replace('-',' ').title())},'#FF4545');")
for i,n in enumerate(NOTES):
    crew = list(CREWS)[i % 6]
    L.append(f"insert into nodes (id,type,label,dept_id) values ('{uid('n:'+n)}','note',{q(n)},'{uid('d:'+crew)}');")
    L.append(f"insert into edges (src,dst,kind) values ('{uid('n:'+n)}','{uid('d:'+crew)}','references');")

# ---- agents + vault files + graph nodes/edges ----
n_agents = 0
for crew, rows in ROSTER.items():
    for slug,name,role,tools,cron in rows:
        n_agents += 1
        (vault/f"{slug}.md").write_text(TPL.format(slug=slug,name=name,crew=crew,role=role,tools=", ".join(tools),cron=cron))
        L.append(f"insert into agents (id,slug,name,dept_id,role,identity_path,schedule_cron,tools,status) values ('{uid('a:'+slug)}',{q(slug)},{q(name)},'{uid('d:'+crew)}',{q(role)},'/vault/agents/{slug}.md',{q(cron)},{arr(tools)},'shadow');")
        L.append(f"insert into nodes (id,type,label,dept_id) values ('{uid('a:'+slug)}','agent',{q(name)},'{uid('d:'+crew)}');")
        L.append(f"insert into edges (src,dst,kind) values ('{uid('a:'+slug)}','{uid('d:'+crew)}','belongs_to');")
        for t in tools:
            if t in TOOLS:
                L.append(f"insert into edges (src,dst,kind) values ('{uid('a:'+slug)}','{uid('t:'+t)}','uses');")

# conductor (agent #35)
(vault/"conductor.md").write_text(TPL.format(slug="conductor",name="Conductor",crew="tech",
  role="Super agent - AI Head",tools="broadcast, openclaw, tmux, gbrain",cron="0 7 * * *")
 .replace("permissions: [read_gbrain, write_tasks, draft_reply]","permissions: [broadcast, spawn, tmux, approve_request]")
 .replace("reports_to: conductor","reports_to: operator"))
n_agents += 1
L.append(f"insert into agents (id,slug,name,role,identity_path,tools,status) values ('{uid('a:conductor')}','conductor','Conductor','Super agent - AI Head','/vault/agents/conductor.md',{arr(['broadcast','openclaw','tmux','gbrain'])},'live');")
L.append(f"insert into nodes (id,type,label) values ('{uid('a:conductor')}','agent','Conductor');")

# ---- demo business state (matches reference dashboard) ----
for i,v in enumerate([5000,6000,6500,7000,7500,6000,7000]):
    L.append(f"insert into deals (title,value_usd,stage) values ({q(f'Won deal {i+1}')},{v},'closed_won');")
for i in range(6):
    L.append(f"insert into deals (title,stage,stalled) values ({q(f'Open deal {i+1}')},'open',{'true' if i<3 else 'false'});")
stages = ["converted"]*7+["opted_in"]*8+["nurtured"]*5+["engaged"]*8+["first_touch"]*6
for i,s in enumerate(stages):
    L.append(f"insert into journeys (contact,stage) values ({q('J-'+str(i+1))},{q(s)});")
TASKS = [("Cut the sales-call highlight reel","doing"),("Qualify 22 new DMs from the campaign","open"),
 ("Schedule this week's cross-platform posts","doing"),("Generate 5 UGC variants for the new offer","open"),
 ("Quote financing for Launchpad cohort","open"),("Reconcile Stripe payout batch","doing"),
 ("Onboard 2 new clients","done"),("Digest Slack #launch","done"),("Triage overnight inbox","done"),
 ("Update Attio after calls","done"),("Draft weekly exec report","open")]
for t,s in TASKS:
    L.append(f"insert into tasks (title,state) values ({q(t)},{q(s)});")
for ch in ["gmail","whatsapp","slack"]*2:
    L.append(f"insert into messages (channel,counterpart,summary,triage) values ({q(ch)},{q('contact')},{q('needs reply')},{q('needs_approval')});")
# funnel = reached-stage suffix sums of `stages`: 34/28/20/15/7
L.append(f"insert into kpi_daily (day,snapshot) values (current_date,{J({'pipeline_open':6,'pipeline_stalled':3,'closed_won_usd':45000,'closed_won_deals':7,'monthly_usd':3900,'funnel':[34,28,20,15,7],'workforce_live':35,'workforce_target':30,'run_success':1.0,'runs':21,'board':{'open':4,'doing':3,'done':4}})});")

Path("seed.sql").write_text("\n".join(L) + "\n")
n_nodes = 1 + 6 + n_agents + len(TOOLS) + len(NOTES)
print(f"agents={n_agents} nodes={n_nodes} connectors={len(CONN)} sql_lines={len(L)}")
assert n_agents == 35 and n_nodes == 114 and len(CONN) == 22, "seed counts drifted from reference"
