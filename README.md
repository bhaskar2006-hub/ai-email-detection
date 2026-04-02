# 🤖 Support Triage Copilot — AI Email Detection

An intelligent, full-stack customer support triage platform powered by **Grok AI (xAI)**. Automatically fetches, analyzes, and categorizes support emails from Gmail, routing them to the right teams with urgency scoring, SLA tracking, and AI-drafted replies.

**🌐 Live Demo:** [ai-email-detection-arlq.vercel.app](https://ai-email-detection-arlq.vercel.app)

---

## ✨ Features

- 🔐 **Supabase Authentication** — Secure sign-in/sign-up with session management
- 📧 **Gmail OAuth Integration** — Connect Gmail and auto-fetch unread emails
- 🧠 **AI Email Triage** — Powered by Grok (xAI) via OpenAI-compatible SDK
- 🗂️ **Smart Categorization** — Billing, Bug, Feature Request, Account Access, Refund, General Query
- 🚨 **Urgency Detection** — High / Medium / Low with SLA deadlines
- 👥 **Team Routing** — Auto-assigns to Engineering, Finance, Product, or Support
- 💬 **AI-drafted Replies** — Suggested email responses per ticket
- 📊 **Analytics Dashboard** — Visual breakdown of ticket trends
- 🔔 **SLA Tracking** — Breach warnings and on-track indicators
- 🌙 **Dark Mode UI** — Premium glassmorphism design

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Vercel (Frontend)                       │
│         React + Vite + Supabase Auth                │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│           Railway (Node.js Backend)                  │
│      Express + Mongoose + Google APIs               │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
┌──────────▼──────────┐  ┌─────────▼───────────────┐
│  Railway (AI Service)│  │   MongoDB Atlas         │
│  Python Flask + Grok │  │   Cloud Database        │
└─────────────────────┘  └─────────────────────────┘
```

---

## 🚀 Live Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [ai-email-detection-arlq.vercel.app](https://ai-email-detection-arlq.vercel.app) |
| Backend | Railway | `ai-email-detection-production-94d8.up.railway.app` |
| AI Service | Railway | `ai-email-detection-production.up.railway.app` |
| Database | MongoDB Atlas | Cluster0 |

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + **Vite**
- **Supabase** — Authentication
- **@react-oauth/google** — Gmail OAuth
- **Axios** — API calls
- **Recharts** — Analytics charts

### Backend
- **Node.js** + **Express**
- **Mongoose** + **MongoDB Atlas**
- **Google APIs** — Gmail access
- **dotenv** — Environment variables

### AI Service
- **Python** + **Flask**
- **Grok (xAI)** via OpenAI-compatible SDK
- **Gunicorn** — Production WSGI server
- Rule-based fallback for resilience

---

## 📦 Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB (local or Atlas)
- xAI API Key (for Grok)
- Google Cloud OAuth credentials

### 1. Clone the repository
```bash
git clone https://github.com/bhaskar2006-hub/ai-email-detection.git
cd ai-email-detection
```

### 2. Setup the AI Service
```bash
cd ai-service
pip install -r requirements.txt
```

Create `ai-service/.env`:
```env
EMAIL_TRIAGE_MODE=grok
XAI_API_KEY=your_xai_api_key_here
GROK_MODEL=grok-3-mini
```

```bash
python app.py
# Runs on http://localhost:5001
```

### 3. Setup the Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=postmessage
MONGO_URI=mongodb://localhost:27017/emailDB
AI_SERVICE_URL=http://localhost:5001
```

```bash
node server.js
# Runs on http://localhost:5000
```

### 4. Setup the Frontend
```bash
cd frotend
npm install
```

Create `frotend/.env`:
```env
VITE_BACKEND_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
# Runs on http://localhost:5173
```

---

## ☁️ Deploy to Railway + Vercel

### 1. AI Service (Railway)
- Root Directory: `/ai-service`
- Start Command: `gunicorn app:app -b 0.0.0.0:$PORT`
- Variables: `XAI_API_KEY`, `GROK_MODEL`, `EMAIL_TRIAGE_MODE`

### 2. Backend (Railway)
- Root Directory: `/backend`
- Variables: `MONGO_URI`, `AI_SERVICE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### 3. Frontend (Vercel)
- Root Directory: `frotend`
- Variables: `VITE_BACKEND_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 📁 Project Structure

```
ai-email-detection/
├── frotend/                # React + Vite frontend
│   └── src/
│       ├── pages/          # LoginPage, SettingsPage, etc.
│       ├── components/     # TicketDrawer, etc.
│       └── App.jsx         # Main app + routing
├── backend/                # Node.js + Express API
│   └── server.js           # All API routes
├── ai-service/             # Python Flask AI engine
│   ├── app.py              # Flask routes + Grok integration
│   └── requirements.txt
└── README.md
```

---

## 📄 License

MIT License — feel free to fork and build on top of this project!
