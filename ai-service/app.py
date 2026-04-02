"""
Email Triage API — Support Triage Copilot
Powered by Grok (xAI) with pipeline-style AI analysis.

Modes (set via EMAIL_TRIAGE_MODE env var):
  grok        → xAI Grok API (default, best quality)
  hf_local    → HuggingFace local transformers (no API key)
  rule_based  → Keyword fallback (always works)
"""

import os
import re
import json
import logging
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ─── Config ────────────────────────────────────────────────────────────────────
MODE          = os.getenv("EMAIL_TRIAGE_MODE", "grok")
XAI_API_KEY   = os.getenv("XAI_API_KEY", "")
GROK_MODEL    = os.getenv("GROK_MODEL", "grok-3-mini")
HF_ZSC_MODEL  = os.getenv("HF_ZSC_MODEL", "facebook/bart-large-mnli")
HF_SUMM_MODEL = os.getenv("HF_SUMM_MODEL", "sshleifer/distilbart-cnn-12-6")

CATEGORIES = ["Billing", "Bug", "Feature Request", "General Query", "Account Access", "Refund"]
URGENCIES  = ["High", "Medium", "Low"]
TEAM_MAP   = {
    "Bug":             "Engineering",
    "Billing":         "Finance",
    "Refund":          "Finance",
    "Feature Request": "Product",
    "General Query":   "Support",
    "Account Access":  "Support",
}

# Roster of team members per department (used for recommended_member routing)
MEMBER_ROSTER = {
    "Engineering": ["Sarah Chen", "Marcus Lee"],
    "Finance":     ["Priya Sharma", "James Okafor"],
    "Product":     ["Emily Torres"],
    "Support":     ["Alex Kim", "Zoe Nguyen"],
}

ROUTING_RULES = {
    ("Billing", "High"):   ("Finance", "Priya Sharma"),
    ("Billing", "Medium"): ("Finance", "James Okafor"),
    ("Billing", "Low"):    ("Finance", "James Okafor"),
    ("Bug", "High"):       ("Engineering", "Sarah Chen"),
    ("Bug", "Medium"):     ("Engineering", "Marcus Lee"),
    ("Bug", "Low"):        ("Engineering", "Marcus Lee"),
    ("Refund", "High"):    ("Finance", "Priya Sharma"),
    ("Refund", "Medium"):  ("Finance", "Priya Sharma"),
    ("Refund", "Low"):     ("Finance", "James Okafor"),
    ("Feature Request", "High"):   ("Product", "Emily Torres"),
    ("Feature Request", "Medium"): ("Product", "Emily Torres"),
    ("Feature Request", "Low"):    ("Product", "Emily Torres"),
    ("General Query", "High"):   ("Support", "Alex Kim"),
    ("General Query", "Medium"): ("Support", "Alex Kim"),
    ("General Query", "Low"):    ("Support", "Zoe Nguyen"),
    ("Account Access", "High"):   ("Support", "Alex Kim"),
    ("Account Access", "Medium"): ("Support", "Zoe Nguyen"),
    ("Account Access", "Low"):    ("Support", "Zoe Nguyen"),
}

def get_routing(category: str, urgency: str):
    key = (category, urgency)
    if key in ROUTING_RULES:
        return ROUTING_RULES[key]
    team = TEAM_MAP.get(category, "Support")
    members = MEMBER_ROSTER.get(team, ["Support Team"])
    return team, members[0]


# ─── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert AI assistant that triages customer support emails for a software company called "Support Triage Copilot".

Analyze the given email and return ONLY valid JSON — no markdown, no explanation, no extra text.

Return this exact JSON structure:
{
  "category": "Billing" | "Bug" | "Feature Request" | "General Query" | "Account Access" | "Refund",
  "urgency": "High" | "Medium" | "Low",
  "team": "Finance" | "Engineering" | "Product" | "Support",
  "intent": "<one short phrase describing what the customer wants, e.g. 'requesting a refund for duplicate charge'>",
  "summary": "<one short, clear sentence capturing the main issue>",
  "sentiment": "Positive" | "Neutral" | "Negative" | "Frustrated" | "Angry",
  "recommended_member": "<first name and last name of best-fit team member from: Sarah Chen, Marcus Lee, Priya Sharma, James Okafor, Emily Torres, Alex Kim, Zoe Nguyen>",
  "suggested_reply": "<a drafted, polite, and helpful short email reply>",
  "confidence_score": <float between 0.0 and 1.0>,
  "reasoning": "<one sentence explaining why you chose this category and urgency>"
}

Classification rules:
CATEGORY:
  - Billing        → payment issues, invoices, subscriptions, duplicate charges (not refunds)
  - Bug            → errors, crashes, login failures, 500/404 errors, broken features
  - Feature Request → suggestions, new functionality requests, improvements
  - General Query  → how-to questions, setup help, general doubts, information
  - Account Access → cannot log in, locked out, password reset, 2FA issues
  - Refund         → explicit refund requests, money back requests, charge disputes

URGENCY:
  - High   → urgent, ASAP, system down, blocking team, payment failure, data loss, security breach, client meeting deadline
  - Medium → affects usage but not completely blocking, waiting on fix, incorrect behaviour
  - Low    → general question, suggestion, informational, no time pressure

TEAM:
  - Engineering → Bug
  - Finance     → Billing, Refund
  - Product     → Feature Request
  - Support     → General Query, Account Access

RECOMMENDED_MEMBER routing:
  - Bug + High → Sarah Chen (Lead Engineer)
  - Bug + Med/Low → Marcus Lee (Senior Dev)
  - Billing/Refund + High → Priya Sharma (Finance Manager)
  - Billing/Refund + Med/Low → James Okafor (Account Manager)
  - Feature Request → Emily Torres (Product Owner)
  - General Query + High → Alex Kim (Support Lead)
  - Account Access → Alex Kim or Zoe Nguyen
  - General Query + Low → Zoe Nguyen (Support Agent)

SENTIMENT:
  - Positive → happy, grateful, complimenting the product
  - Neutral → informational, matter-of-fact tone
  - Negative → disappointed, unhappy, dissatisfied
  - Frustrated → clearly irritated, has tried multiple times
  - Angry → aggressive, threatening, using caps or exclamation marks heavily

CONFIDENCE:
  - 0.9–1.0 → very clear and obvious classification
  - 0.7–0.9 → fairly confident
  - 0.5–0.7 → some ambiguity
  - below 0.5 → unclear email, best guess used
"""


# ─── Mode 1: Grok (xAI) ────────────────────────────────────────────────────────
def analyze_with_grok(email_text: str, subject: str = "", sender: str = "") -> dict:
    from openai import OpenAI

    client = OpenAI(
        api_key=XAI_API_KEY,
        base_url="https://api.x.ai/v1",
    )

    context_parts = []
    if sender:
        context_parts.append(f"From: {sender}")
    if subject:
        context_parts.append(f"Subject: {subject}")
    context_parts.append(f"\nEmail Body:\n{email_text}")
    full_text = "\n".join(context_parts)

    logger.info(f"Calling Grok model: {GROK_MODEL}")

    response = client.chat.completions.create(
        model=GROK_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"EMAIL:\n{full_text}"},
        ],
        temperature=0.1,
        max_tokens=700,
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()

    parsed = json.loads(raw)

    # Normalize and fill defaults
    parsed.setdefault("reasoning", "")
    parsed.setdefault("intent", "")
    parsed.setdefault("sentiment", "Neutral")
    parsed.setdefault("suggested_reply", "Thank you for reaching out. Our team is looking into this and will get back to you shortly.")
    parsed["confidence_score"] = round(float(parsed.get("confidence_score", 0.8)), 2)

    # Use routing table to set team + recommended_member
    category = parsed.get("category", "General Query")
    urgency  = parsed.get("urgency", "Medium")
    team, member = get_routing(category, urgency)
    parsed["team"] = team
    # Only override recommended_member if AI didn't provide a good one
    if not parsed.get("recommended_member") or parsed.get("recommended_member") not in [
        "Sarah Chen", "Marcus Lee", "Priya Sharma", "James Okafor", "Emily Torres", "Alex Kim", "Zoe Nguyen"
    ]:
        parsed["recommended_member"] = member

    return parsed


# ─── Mode 2: HuggingFace Local ─────────────────────────────────────────────────
_zsc_pipeline  = None
_summ_pipeline = None

def _get_zsc():
    global _zsc_pipeline
    if _zsc_pipeline is None:
        from transformers import pipeline
        logger.info(f"Loading zero-shot model: {HF_ZSC_MODEL}")
        _zsc_pipeline = pipeline("zero-shot-classification", model=HF_ZSC_MODEL, device=-1)
    return _zsc_pipeline

def _get_summarizer():
    global _summ_pipeline
    if _summ_pipeline is None:
        from transformers import pipeline
        logger.info(f"Loading summarization model: {HF_SUMM_MODEL}")
        _summ_pipeline = pipeline("summarization", model=HF_SUMM_MODEL, device=-1)
    return _summ_pipeline

def analyze_with_hf_local(email_text: str, subject: str = "", sender: str = "") -> dict:
    zsc = _get_zsc()
    text = f"{subject}\n{email_text}".strip()

    cat_result = zsc(text, candidate_labels=CATEGORIES,
                     hypothesis_template="This email is about {}.", multi_label=False)
    urg_result = zsc(text, candidate_labels=URGENCIES,
                     hypothesis_template="The urgency level of this email is {}.", multi_label=False)

    category = cat_result["labels"][0]
    urgency  = urg_result["labels"][0]
    conf     = round((cat_result["scores"][0] + urg_result["scores"][0]) / 2, 2)
    team, member = get_routing(category, urgency)

    summarizer = _get_summarizer()
    max_tok    = min(130, max(30, len(text.split()) // 3))
    summary    = summarizer(text, max_length=max_tok, min_length=20, do_sample=False)[0]["summary_text"].strip()

    return {
        "category":           category,
        "urgency":            urgency,
        "team":               team,
        "intent":             f"{category.lower()} inquiry",
        "summary":            summary,
        "sentiment":          "Neutral",
        "recommended_member": member,
        "suggested_reply":    f"Thank you for contacting us about a {category}. We have assigned this to the {team} team ({member}), and they will follow up shortly.",
        "confidence_score":   conf,
        "reasoning":          f"Zero-shot BART classified as {category} ({round(cat_result['scores'][0]*100)}% confidence).",
    }


# ─── Mode 3: Rule-based fallback ───────────────────────────────────────────────
CATEGORY_KEYWORDS = {
    "Billing":         ["invoice","bill","charge","payment","subscription","paid","price","cost","fee","receipt","credit","debit","transaction"],
    "Refund":          ["refund","money back","reimburse","charge back","dispute","overcharged","charged twice","duplicate charge"],
    "Bug":             ["error","crash","not working","broken","bug","issue","fail","exception","500","404","glitch","problem","down","cannot access","won't load","doesn't work","stuck"],
    "Feature Request": ["feature","suggestion","would be great","could you add","please add","enhancement","improvement","request","wish","dark mode","option","ability to","support for"],
    "Account Access":  ["can't log in","cannot login","locked out","password","reset","two factor","2fa","account locked","access denied","sign in"],
    "General Query":   ["question","how do i","how to","help","wondering","curious","information","clarify","explain","understand","what is"],
}
HIGH_KEYWORDS   = ["urgent","immediately","asap","emergency","critical","right now","cannot access","not working","down","outage","broken","crash","data loss","security","breach","refund","charge twice","duplicate","before tomorrow","client meeting","deadline","blocking"]
MEDIUM_KEYWORDS = ["soon","please","waiting","pending","delayed","follow up","still not","issue","problem","slow","incorrect"]

INTENT_MAP = {
    "Billing":         "reporting a billing issue",
    "Refund":          "requesting a refund",
    "Bug":             "reporting a bug or technical issue",
    "Feature Request": "requesting a new feature",
    "General Query":   "asking a general support question",
    "Account Access":  "requesting account access help",
}

def analyze_with_rules(email_text: str, subject: str = "", sender: str = "") -> dict:
    t = (subject + " " + email_text).lower()
    scores = {c: sum(1 for kw in kws if kw in t) for c, kws in CATEGORY_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    category = best if scores[best] > 0 else "General Query"
    urgency = "High" if any(k in t for k in HIGH_KEYWORDS) else \
              "Medium" if any(k in t for k in MEDIUM_KEYWORDS) else "Low"
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", email_text.strip()) if len(s.strip()) > 15]
    summary = " ".join(sentences[:2])[:300] if sentences else email_text[:200]
    team, member = get_routing(category, urgency)

    return {
        "category":           category,
        "urgency":            urgency,
        "team":               team,
        "intent":             INTENT_MAP.get(category, "contacting support"),
        "summary":            summary,
        "sentiment":          "Negative" if urgency == "High" else "Neutral",
        "recommended_member": member,
        "suggested_reply":    f"Hello, we have received your {category.lower()} request and assigned it to {member} on the {team} team. You will receive an update within {'2 hours' if urgency == 'High' else '24 hours' if urgency == 'Medium' else '48 hours'}.",
        "confidence_score":   0.55,
        "reasoning":          f"Rule-based keyword match → {category}, urgency {urgency}.",
    }


# ─── Router ─────────────────────────────────────────────────────────────────────
def analyze_email(email_text: str, subject: str = "", sender: str = "") -> dict:
    try:
        if MODE == "grok":
            return analyze_with_grok(email_text, subject, sender)
        elif MODE == "hf_local":
            return analyze_with_hf_local(email_text, subject, sender)
        else:
            return analyze_with_rules(email_text, subject, sender)
    except Exception as e:
        logger.warning(f"Primary mode [{MODE}] failed: {e} — falling back to rule_based")
        result = analyze_with_rules(email_text, subject, sender)
        result["fallback"] = True
        result["error"]    = str(e)
        return result


# ─── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    if not data or "email" not in data:
        return jsonify({"error": "Missing 'email' field in request body"}), 400
    text = data["email"].strip()
    if not text:
        return jsonify({"error": "Email text is empty"}), 400

    subject = data.get("subject", "")
    sender  = data.get("sender", "")

    result = analyze_email(text, subject, sender)
    result["model"] = GROK_MODEL if MODE == "grok" else MODE
    return jsonify(result)


@app.route("/analyze-batch", methods=["POST"])
def analyze_batch():
    data = request.get_json()
    if not data or "emails" not in data or not isinstance(data["emails"], list):
        return jsonify({"error": "Missing 'emails' array in request body"}), 400

    results = []
    for item in data["emails"]:
        text    = (item.get("email") or item.get("body") or "").strip()
        subject = item.get("subject", "")
        sender  = item.get("sender", "")
        if not text:
            continue
        result = analyze_email(text, subject, sender)
        result["model"] = GROK_MODEL if MODE == "grok" else MODE
        results.append(result)

    return jsonify({"count": len(results), "results": results})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":   "ok",
        "mode":     MODE,
        "model":    GROK_MODEL if MODE == "grok" else MODE,
        "endpoint": "https://api.x.ai/v1" if MODE == "grok" else "local",
    })


@app.route("/modes", methods=["GET"])
def modes():
    return jsonify({
        "current_mode": MODE,
        "available": {
            "grok":       f"xAI Grok ({GROK_MODEL}) — needs XAI_API_KEY",
            "hf_local":   "HuggingFace BART zero-shot — no API key",
            "rule_based": "Keyword matching — instant fallback",
        }
    })


@app.route("/routing-rules", methods=["GET"])
def routing_rules():
    rules = [
        {"category": cat, "urgency": urg, "team": team, "member": member}
        for (cat, urg), (team, member) in ROUTING_RULES.items()
    ]
    return jsonify({"rules": rules})


if __name__ == "__main__":
    if MODE == "grok" and not XAI_API_KEY:
        logger.warning("XAI_API_KEY is not set! Set it in .env or as environment variable.")
    port = int(os.environ.get("PORT", 5001))
    logger.info(f"Support Triage Copilot AI — mode: [{MODE}] model: [{GROK_MODEL}] on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
