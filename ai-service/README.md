# Email Triage API — Grok (xAI) Powered

Classifies support emails using **xAI's Grok** model via the OpenAI-compatible API.

---

## How Grok Classification Works

```
Email text
    │
    ▼
POST https://api.x.ai/v1/chat/completions
    model: grok-3-mini
    system: detailed triage instructions
    user: EMAIL: {email_text}
    │
    ▼
Grok returns structured JSON
    │
    ▼
{
  "category":         "Bug",
  "urgency":          "High",
  "team":             "Engineering",
  "summary":          "User reports 500 error blocking entire team since morning.",
  "confidence_score": 0.96,
  "reasoning":        "Clear bug report with high urgency due to team-wide impact."
}
```

Grok uses the same OpenAI SDK interface — just swap the `base_url` to `https://api.x.ai/v1`.

---

## Setup

### 1. Get xAI API Key
- Go to https://console.x.ai
- Sign up / log in → API Keys → Create key

### 2. Install dependencies
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — add your XAI_API_KEY
```

### 4. Run
```bash
python app.py
```
API runs at: `http://localhost:5001`

---

## API

### POST /analyze
```bash
curl -X POST http://localhost:5001/analyze \
  -H "Content-Type: application/json" \
  -d '{"email": "Hi, I was charged twice this month. Please refund."}'
```

**Response:**
```json
{
  "category": "Billing",
  "urgency": "Medium",
  "team": "Finance",
  "summary": "Customer reports a duplicate charge and requests a refund.",
  "confidence_score": 0.94,
  "reasoning": "Clear billing issue with refund request; medium urgency as no immediate blocking.",
  "model": "grok-3-mini"
}
```

### GET /health
### GET /modes

---

## Grok Models

| Model | Speed | Quality | Use case |
|-------|-------|---------|----------|
| `grok-3-mini` | Fast | Good | Classification tasks (recommended) |
| `grok-3` | Slower | Best | Complex reasoning |
| `grok-2-1212` | Fast | Good | Stable older version |

Set in `.env`:
```
GROK_MODEL=grok-3-mini
```

---

## Modes

| Mode | Engine | Requires |
|------|--------|----------|
| `grok` | xAI Grok API | `XAI_API_KEY` |
| `hf_local` | HuggingFace BART | Nothing |
| `rule_based` | Keywords | Nothing |

Auto-falls back to `rule_based` if Grok call fails.

---

## Files

```
email-triage-grok/
├── app.py            ← Main Flask app with Grok integration
├── requirements.txt
├── .env.example
├── test_api.py
└── README.md
```
