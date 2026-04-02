/* ──────────────────────────────────────────────────────────────
   TicketDrawer.jsx  —  Support Triage Copilot
   Full-featured right-side drawer for ticket details
──────────────────────────────────────────────────────────────── */
import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/* ── constants shared with parent ── */
export const STATUS_CONFIG = {
  new:         { label: "New",         color: "#6366f1", bg: "#eff2ff" },
  assigned:    { label: "Assigned",    color: "#0ea5e9", bg: "#e0f2fe" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "#fffbeb" },
  escalated:   { label: "Escalated",   color: "#ef4444", bg: "#fef2f2" },
  resolved:    { label: "Resolved",    color: "#22c55e", bg: "#f0fdf4" },
  snoozed:     { label: "Snoozed",     color: "#8b5cf6", bg: "#f5f3ff" },
  pending:     { label: "Pending",     color: "#94a3b8", bg: "#f8fafc" },
};

const DEPT_COLORS = {
  Engineering:          { bg: "#dbeafe", color: "#1d4ed8" },
  Finance:              { bg: "#dcfce7", color: "#15803d" },
  Product:              { bg: "#f3e8ff", color: "#7c3aed" },
  Support:              { bg: "#fef3c7", color: "#92400e" },
  "Customer Success":   { bg: "#ccfbf1", color: "#0f766e" },
  "Billing Operations": { bg: "#dcfce7", color: "#15803d" },
  Sales:                { bg: "#fce7f3", color: "#9d174d" },
};

const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};

/* ── helpers ── */
function getInitials(str = "") {
  return str.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}
function getSLADisplay(dateStr) {
  if (!dateStr) return { text: "No SLA", state: "safe", pct: 100 };
  const due = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = due - now;
  if (diff < 0) return { text: "SLA Breached", state: "breached", pct: 0 };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours < 1) return { text: `${mins}m left`, state: "warning", pct: 20 };
  const pct = Math.min(100, Math.round((hours / 48) * 100));
  return { text: `${hours}h ${mins}m left`, state: "safe", pct };
}
function urgencyLevel(u = "") {
  const l = (u || "").toLowerCase();
  if (l.includes("high")) return "high";
  if (l.includes("medium")) return "medium";
  return "low";
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function generateReplyVariants(baseReply = "", category = "", member = "", sender = "") {
  const firstName = (sender || "").split(/[\s<@]/)[0] || "there";
  const formal = `Dear ${firstName},\n\nThank you for contacting our support team. We have received your ${category} inquiry and it has been assigned to ${member || "our support team"} with high priority.\n\n${baseReply}\n\nPlease keep this ticket reference for any follow-up queries. We aim to resolve your issue as swiftly as possible.\n\nBest regards,\nSupport Team`;
  const empathetic = `Hi ${firstName},\n\nThank you for reaching out — we completely understand how frustrating this must be, and we sincerely apologize for the inconvenience caused.\n\n${baseReply}\n\n${member || "A team member"} will personally follow up with you soon. We genuinely care about getting this sorted for you. Don't hesitate to reply if you need anything in the meantime.\n\nWith care,\nThe Support Team`;
  const brief = baseReply || `Hi, thanks for reaching out about your ${category} issue. We're on it and will update you shortly.`;
  return [
    { type: "formal",     label: "Formal",     icon: "📋", text: formal },
    { type: "empathetic", label: "Empathetic",  icon: "💙", text: empathetic },
    { type: "brief",      label: "Brief",       icon: "⚡",  text: brief },
  ];
}

/* ── sub-components ── */
function DrawerStatusChip({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const ALL_STATUSES = ["new", "assigned", "in_progress", "escalated", "resolved", "snoozed"];
  return (
    <div className="drawer-status-wrap">
      <span
        className="drawer-status-chip"
        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + "40" }}
        onClick={() => setOpen(v => !v)}
        title="Click to change status"
      >
        <span className="status-chip-dot" style={{ background: cfg.color }} />
        {cfg.label}
        <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
      </span>
      {open && (
        <div className="drawer-status-dropdown">
          {ALL_STATUSES.map(s => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                className="drawer-status-option"
                style={{ color: c.color }}
                onClick={() => { onChange(s); setOpen(false); }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, display: "inline-block", marginRight: 8 }} />
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfidenceRing({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  const r = 28, circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <div className="confidence-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f5f9" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="confidence-ring-label" style={{ color }}>
        <span className="confidence-ring-pct">{pct}%</span>
        <span className="confidence-ring-sub">AI confidence</span>
      </div>
    </div>
  );
}

function ReplyTabs({ baseReply, category, member, sender }) {
  const [active, setActive] = useState("formal");
  const [copied, setCopied] = useState(false);
  const variants = generateReplyVariants(baseReply, category, member, sender);
  const current = variants.find(v => v.type === active) || variants[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="reply-tabs-container">
      <div className="reply-tab-header">
        <div className="reply-tabs">
          {variants.map(v => (
            <button
              key={v.type}
              className={`reply-tab ${active === v.type ? "active" : ""}`}
              onClick={() => setActive(v.type)}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <button className={`reply-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
          {copied ? "✓ Copied!" : "📋 Copy"}
        </button>
      </div>
      <div className="reply-content">{current.text}</div>
    </div>
  );
}

function SimilarTicketsPanel({ similarIds, allEmails, onMerge }) {
  const similars = allEmails.filter(e => similarIds.includes(e._id));
  if (!similars.length) return null;
  return (
    <div className="similar-panel">
      <div className="similar-panel-header">
        <span>🔁 {similars.length} Similar Ticket{similars.length > 1 ? "s" : ""} Detected</span>
      </div>
      {similars.map(e => (
        <div className="similar-item" key={e._id}>
          <div className="similar-item-left">
            <span className="similar-item-cat">{CATEGORY_ICONS[e.category] || "🏷️"} {e.category}</span>
            <span className="similar-item-text" title={e.summary}>{(e.summary || e.email)?.slice(0, 70)}…</span>
          </div>
          <button className="similar-merge-btn" onClick={() => onMerge(e._id)} title="Mark as duplicate">
            Merge
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── MAIN DRAWER ── */
export default function TicketDrawer({ ticket, allEmails, similarIds = [], onClose, onStatusChange, onAssign, onEscalate, onResolve, onSnooze, onDelete, onReassign, onMerge, addToast }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState(ticket?.assigned_to || ticket?.recommended_member || "");
  const TEAMS = ["Engineering", "Finance", "Product", "Support", "Customer Success"];

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!ticket) return null;

  const lvl  = urgencyLevel(ticket.urgency);
  const sla  = getSLADisplay(ticket.sla_due);
  const deptColor = DEPT_COLORS[ticket.team] || { bg: "#f3f5f9", color: "#374151" };
  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.new;

  const handleAssignSubmit = () => {
    onAssign(ticket._id, assignTo);
    setAssignOpen(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ticket-drawer" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="td-header">
          <div className="td-header-left">
            <div className="td-avatar">{getInitials(ticket.sender || ticket.subject || "")}</div>
            <div className="td-title-block">
              <div className="td-subject" title={ticket.subject}>{ticket.subject || "No Subject"}</div>
              <div className="td-sender">{ticket.sender || "Unknown Sender"} · {timeAgo(ticket.createdAt)}</div>
            </div>
          </div>
          <div className="td-header-right">
            <DrawerStatusChip
              status={ticket.status || "new"}
              onChange={(s) => onStatusChange(ticket._id, s)}
            />
            <button className="td-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Action Bar ── */}
        <div className="td-action-bar">
          <button className="td-action td-action-assign" onClick={() => setAssignOpen(v => !v)}>
            👥 Assign
          </button>
          <button className="td-action td-action-escalate" onClick={() => { onEscalate(ticket._id); onClose(); }}>
            ⬆️ Escalate
          </button>
          <button className="td-action td-action-snooze" onClick={() => { onSnooze(ticket._id); onClose(); }}>
            😴 Snooze
          </button>
          <button
            className={`td-action ${ticket.status === "resolved" ? "td-action-reopen" : "td-action-resolve"}`}
            onClick={() => { onResolve(ticket._id, ticket.status); onClose(); }}
          >
            {ticket.status === "resolved" ? "↩️ Reopen" : "✅ Resolve"}
          </button>
          <button className="td-action td-action-delete" onClick={() => { onDelete(ticket._id); onClose(); }}>
            🗑️
          </button>
        </div>

        {/* Assign panel */}
        {assignOpen && (
          <div className="td-assign-panel">
            <input
              className="td-assign-input"
              placeholder="Type name or pick a team…"
              value={assignTo}
              onChange={e => setAssignTo(e.target.value)}
            />
            <div className="td-assign-teams">
              <span style={{ fontSize: 11, color: "#9ca3af", marginRight: 6 }}>Quick:</span>
              {TEAMS.map(t => (
                <button key={t} className="td-assign-team-btn" onClick={() => { setAssignTo(t); }}>
                  {t}
                </button>
              ))}
            </div>
            <div className="td-assign-actions">
              <button className="td-assign-confirm" onClick={handleAssignSubmit}>Confirm Assignment</button>
              <button className="td-assign-cancel" onClick={() => setAssignOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="td-body">

          {/* AI Classification */}
          <div className="td-section td-classification-row">
            <span className="td-cat-badge">
              <span>{CATEGORY_ICONS[ticket.category] || "🏷️"}</span>
              {ticket.category}
            </span>
            <span className={`urgency-tag ${lvl}`}>{lvl.toUpperCase()}</span>
            <span className={`sentiment-badge ${(ticket.sentiment || "neutral").toLowerCase()}`}>
              {{ positive: "🙂", negative: "😤", neutral: "😐", frustrated: "😠", angry: "🤬" }[(ticket.sentiment || "Neutral").toLowerCase()] || "😐"} {ticket.sentiment || "Neutral"}
            </span>
          </div>

          {/* Confidence + Routing Grid */}
          <div className="td-confidence-routing">
            <ConfidenceRing score={ticket.confidence_score} />
            <div className="td-routing-grid">
              <div className="td-routing-item">
                <span className="td-routing-label">Assigned Team</span>
                <span className="td-routing-value team-badge-pill" style={{ background: deptColor.bg, color: deptColor.color }}>
                  {ticket.team || "Unassigned"}
                </span>
              </div>
              <div className="td-routing-item">
                <span className="td-routing-label">Recommended Member</span>
                <span className="td-routing-value">
                  <span className="td-member-avatar">{getInitials(ticket.recommended_member || "?")}</span>
                  {ticket.recommended_member || "—"}
                </span>
              </div>
              {(ticket.assigned_to || assignTo) && (
                <div className="td-routing-item">
                  <span className="td-routing-label">Currently Assigned To</span>
                  <span className="td-routing-value" style={{ color: "#0ea5e9", fontWeight: 700 }}>
                    ✓ {ticket.assigned_to || assignTo}
                  </span>
                </div>
              )}
              <div className="td-routing-item">
                <span className="td-routing-label">SLA Status</span>
                <span className={`sla-timer ${sla.state}`}>⏳ {sla.text}</span>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          {ticket.reasoning && (
            <div className="td-section td-reasoning-box">
              <div className="td-section-label">🧠 AI Reasoning</div>
              <div className="td-reasoning-text">"{ticket.reasoning}"</div>
            </div>
          )}

          {/* Intent */}
          {ticket.intent && (
            <div className="td-section">
              <div className="td-section-label">🎯 Customer Intent</div>
              <div className="td-intent-text">{ticket.intent}</div>
            </div>
          )}

          {/* Similar Tickets */}
          {similarIds.length > 0 && (
            <SimilarTicketsPanel similarIds={similarIds} allEmails={allEmails} onMerge={onMerge} />
          )}

          {/* Summary */}
          <div className="td-section">
            <div className="td-section-label">📋 AI Summary</div>
            <p className="td-summary-text">{ticket.summary || "No summary available."}</p>
          </div>

          {/* Suggested Replies */}
          <div className="td-section">
            <div className="td-section-label">✍️ AI Suggested Replies</div>
            <ReplyTabs
              baseReply={ticket.suggested_reply}
              category={ticket.category}
              member={ticket.recommended_member}
              sender={ticket.sender}
            />
          </div>

          {/* Full Email Body */}
          <div className="td-section">
            <div className="td-section-label">📧 Full Email</div>
            <div className="td-email-body">{ticket.email}</div>
          </div>

          {/* Metadata */}
          <div className="td-meta-row">
            <span>🕐 Received {timeAgo(ticket.createdAt)}</span>
            {ticket.createdAt && <span>📅 {new Date(ticket.createdAt).toLocaleString()}</span>}
            <button className="td-meta-delete" onClick={() => { onDelete(ticket._id); onClose(); }}>
              Delete ticket
            </button>
          </div>

          {/* Reassign team */}
          <div className="td-section">
            <div className="td-section-label">🔀 Reassign to Team</div>
            <div className="td-reassign-row">
              {["Engineering", "Finance", "Product", "Support", "Customer Success"].map(t => {
                const dc = DEPT_COLORS[t] || {};
                return (
                  <button
                    key={t}
                    className="td-reassign-btn"
                    style={{ background: dc.bg, color: dc.color, borderColor: dc.color + "40" }}
                    onClick={() => { onReassign(ticket._id, t); addToast(`Reassigned to ${t}`); }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
