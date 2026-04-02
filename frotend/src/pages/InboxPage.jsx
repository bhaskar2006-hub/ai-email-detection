/* ──────────────────────────────────────────────────────────────
   InboxPage.jsx  —  Support Triage Copilot
──────────────────────────────────────────────────────────────── */
import { useRef } from "react";
import InboxCard from "../components/InboxCard";
import FilterBar from "../components/FilterBar";

const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};

function extractSubject(emailStr = "") {
  const match = emailStr.match(/Subject:\s*(.+)/i);
  if (match) return match[1].trim();
  const lines = emailStr.trim().split("\n").filter(l => l.trim());
  return lines[0]?.slice(0, 60) || "No Subject";
}
function extractSender(emailStr = "") {
  const match = emailStr.match(/From:\s*(.+)/i);
  if (match) return match[1].trim();
  return "";
}
function urgencyLevel(u = "") {
  const l = (u || "").toLowerCase();
  if (l.includes("high")) return "high";
  if (l.includes("medium")) return "medium";
  return "low";
}
function getSLAState(dateStr) {
  if (!dateStr) return "safe";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return "breached";
  if (diff < 3600000) return "warning";
  return "safe";
}

const SAMPLES = [
  { s: "Duplicate Charge on Invoice #4821", b: "I was charged twice for my subscription this month — invoice #4821 shows two identical charges of $49.99. Please refund the duplicate charge immediately, this is completely unacceptable." },
  { s: "Dashboard keeps crashing on Chrome 120", b: "The dashboard keeps crashing every time I log in on Chrome v120. Error: undefined is not a function at line 42. This is blocking my entire team." },
  { s: "Request: Dark mode for the platform", b: "Could you add a dark mode option to the platform? It would really help during late-night work sessions and reduce eye strain." },
  { s: "URGENT: Cannot login — client presenting in 2hrs", b: "I have been locked out of my account since yesterday. My 2FA authenticator app is not working and I have a critical client presentation in 2 hours. I need access IMMEDIATELY." },
];

export default function InboxPage({
  history, filters, setFilters, similarMap, stats,
  showNewAnalysis, setShowNewAnalysis,
  email, setEmail, subject, setSubject, sender, setSender,
  loading, result, currentId,
  handleAnalyze, handleClear, handleReassign,
  onCardClick, onResolve, onEscalate, onAssign, onSnooze,
  addToast, reassignId, setReassignId,
}) {
  const textareaRef = useRef(null);
  const triagedPct = stats?.triagedPercent ?? 0;

  /* ── filter logic ── */
  const filtered = history.filter(r => {
    const q = (filters.search || "").toLowerCase();
    const subj = (r.subject || extractSubject(r.email)).toLowerCase();
    const sndr = (r.sender || extractSender(r.email)).toLowerCase();
    const matchSearch = !q || subj.includes(q) || sndr.includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.category || "").toLowerCase().includes(q) ||
      (r.team || "").toLowerCase().includes(q) ||
      (r.summary || "").toLowerCase().includes(q);

    const matchCat = filters.category === "All" || r.category === filters.category;
    const matchUrg = filters.urgency === "All" || urgencyLevel(r.urgency) === filters.urgency.toLowerCase();
    const matchSta = filters.status  === "All" || r.status === filters.status || (!r.status && filters.status === "new");
    const matchSla = filters.sla === "All" || getSLAState(r.sla_due) === filters.sla.toLowerCase();
    return matchSearch && matchCat && matchUrg && matchSta && matchSla;
  });

  const unread = history.filter(r => !r.read).length;

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1>Inbox</h1>
          <p className="page-subtitle">
            {unread} unread · {history.length} total · AI Copilot routing active
          </p>
        </div>
        <div className="page-header-right">
          <div className="triaged-badge">
            <span className="triaged-dot" />
            {triagedPct}% Triaged
          </div>
          <button
            className={`compose-btn ${showNewAnalysis ? "compose-btn-active" : ""}`}
            style={{ background: showNewAnalysis ? "#eff2ff" : undefined, color: showNewAnalysis ? "#4f46e5" : undefined, boxShadow: "none", border: "1px solid #e8ecf2" }}
            onClick={() => setShowNewAnalysis(v => !v)}
          >
            {showNewAnalysis ? "✕ Close" : "＋ New Analysis"}
          </button>
        </div>
      </div>

      {/* ── New Analysis Panel (toggle) ── */}
      {showNewAnalysis && (
        <div className="new-analysis-panel card">
          <div className="panel-row">
            {/* Left: Input */}
            <div className="panel-col">
              <div className="analysis-card-title">
                <h2>New Analysis</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  {SAMPLES.map((s, i) => (
                    <button key={i} className="sample-chip" onClick={() => {
                      setEmail(s.b); setSubject(s.s); setSender("");
                      textareaRef.current?.focus();
                    }} title={s.s}>
                      {s.s.slice(0, 18)}…
                    </button>
                  ))}
                </div>
              </div>
              <div className="input-row">
                <div className="half-field">
                  <p className="field-label">Subject</p>
                  <input className="field-input" placeholder="Email subject…" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div className="half-field">
                  <p className="field-label">Sender</p>
                  <input className="field-input" placeholder="sender@example.com" value={sender} onChange={e => setSender(e.target.value)} />
                </div>
              </div>
              <p className="field-label" style={{ marginTop: 10 }}>Email Body</p>
              <textarea ref={textareaRef} className="email-textarea" placeholder="Paste the customer email content here…" value={email} onChange={e => setEmail(e.target.value)} />
              <div className="char-count">{email.length} chars</div>
              <div className="btn-row">
                <button className="analyze-btn" onClick={handleAnalyze} disabled={loading || !email.trim()}>
                  {loading ? (<><span className="spinner" /> Analyzing…</>) : (<><span>✦</span> Analyze with AI</>)}
                </button>
                <button className="clear-btn" onClick={handleClear}>Clear</button>
              </div>
            </div>

            {/* Right: Result */}
            <div className="panel-col">
              {result ? (
                <AnalysisResult result={result} currentId={currentId} reassignId={reassignId} setReassignId={setReassignId} handleReassign={handleReassign} addToast={addToast} onOpen={onCardClick} />
              ) : (
                <div className="empty-result">
                  <div className="empty-icon">🤖</div>
                  <p>Paste an email and click <strong>Analyze with AI</strong> to see results here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* ── Inbox Cards ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="inbox-list-header">
          <span className="inbox-list-title">
            {filtered.length === history.length
              ? `All Tickets (${history.length})`
              : `${filtered.length} of ${history.length} tickets`}
          </span>
          {filtered.length !== history.length && (
            <span className="inbox-filter-active-note">Filters active</span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-result" style={{ minHeight: 200, padding: 32 }}>
            <div className="empty-icon">📭</div>
            <p>{history.length === 0 ? "No tickets yet. Analyze an email or connect Gmail." : "No tickets match your current filters."}</p>
          </div>
        ) : (
          <div className="inbox-cards-list">
            {filtered.map(rec => (
              <InboxCard
                key={rec._id}
                rec={rec}
                similarCount={similarMap[rec._id]?.length || 0}
                onClick={() => onCardClick(rec)}
                onResolve={onResolve}
                onEscalate={onEscalate}
                onAssign={onAssign}
                onSnooze={onSnooze}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── inline Analysis Result ── */
function AnalysisResult({ result, currentId, reassignId, setReassignId, handleReassign, addToast, onOpen }) {
  const lvl = urgencyLevel(result.urgency);
  const pct = Math.round((result.confidence_score || 0) * 100);
  const confColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  const TEAMS = ["Engineering", "Finance", "Product", "Support", "Customer Success"];

  return (
    <>
      <p className="result-card-title">Analysis Result</p>
      <div className="result-row">
        <div className="result-box">
          <p className="result-box-label">Category</p>
          <div className="result-box-value">
            <div className="result-icon blue">{CATEGORY_ICONS[result.category] || "🏷️"}</div>
            {result.category}
          </div>
        </div>
        <div className="result-box">
          <p className="result-box-label">Urgency</p>
          <div style={{ marginTop: 8 }}>
            <span className={`urgency-pill ${lvl}`}><span className="urgency-pill-dot" />{urgencyLevel(result.urgency) === "high" ? "High" : urgencyLevel(result.urgency) === "medium" ? "Medium" : "Low"} Priority</span>
          </div>
        </div>
      </div>

      {result.intent && (
        <div className="result-section">
          <p className="result-section-label">🎯 Intent</p>
          <p className="summary-text" style={{ fontStyle: "italic", color: "#374151" }}>{result.intent}</p>
        </div>
      )}

      {result.reasoning && (
        <div className="result-section" style={{ background: "#fafbff", borderColor: "#c7d2fe" }}>
          <p className="result-section-label">🧠 AI Reasoning</p>
          <p className="summary-text">"{result.reasoning}"</p>
        </div>
      )}

      <div className="result-section">
        <p className="result-section-label">AI Confidence</p>
        <div className="confidence-bar-wrap">
          <div className="confidence-bar-track">
            <div className="confidence-bar-fill" style={{ width: `${pct}%`, background: confColor }} />
          </div>
          <span className="confidence-label" style={{ color: confColor }}>{pct}%</span>
        </div>
      </div>

      <div className="result-section">
        <p className="result-section-label">Assigned Team & Member</p>
        <div className="team-row">
          <div className="team-info">
            <div className="team-icon">👥</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{result.team}</div>
              {result.recommended_member && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>👤 {result.recommended_member}</div>}
            </div>
          </div>
          {reassignId === currentId ? (
            <div className="reassign-dropdown">
              {TEAMS.map(t => <button key={t} className="reassign-option" onClick={() => handleReassign(currentId, t)}>{t}</button>)}
              <button className="reassign-cancel" onClick={() => setReassignId(null)}>Cancel</button>
            </div>
          ) : (
            <a className="reassign-link" href="#" onClick={e => { e.preventDefault(); setReassignId(currentId); }}>Reassign</a>
          )}
        </div>
      </div>

      {result.summary && (
        <div className="result-section">
          <p className="result-section-label">Summary</p>
          <p className="summary-text">{result.summary}</p>
        </div>
      )}

      <button className="view-detail-btn" onClick={() => onOpen && onOpen({ ...result, _id: currentId })}>
        🔍 View Full Detail & Suggested Replies →
      </button>
    </>
  );
}
