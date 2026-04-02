/* ──────────────────────────────────────────────────────────────
   InboxCard.jsx  —  Support Triage Copilot
   Enhanced card with team badge, quick actions, duplicate indicator
──────────────────────────────────────────────────────────────── */
import { useState } from "react";

const DEPT_COLORS = {
  Engineering:          { bg: "#dbeafe", color: "#1d4ed8" },
  Finance:              { bg: "#dcfce7", color: "#15803d" },
  Product:              { bg: "#f3e8ff", color: "#7c3aed" },
  Support:              { bg: "#fef3c7", color: "#92400e" },
  "Customer Success":   { bg: "#ccfbf1", color: "#0f766e" },
  "Billing Operations": { bg: "#dcfce7", color: "#15803d" },
  Sales:                { bg: "#fce7f3", color: "#9d174d" },
};

export const STATUS_CONFIG = {
  new:         { label: "New",         color: "#6366f1", bg: "#eff2ff" },
  assigned:    { label: "Assigned",    color: "#0ea5e9", bg: "#e0f2fe" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "#fffbeb" },
  escalated:   { label: "Escalated",   color: "#ef4444", bg: "#fef2f2" },
  resolved:    { label: "Resolved",    color: "#22c55e", bg: "#f0fdf4" },
  snoozed:     { label: "Snoozed",     color: "#8b5cf6", bg: "#f5f3ff" },
  pending:     { label: "Pending",     color: "#94a3b8", bg: "#f8fafc" },
};

const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};

const SENTIMENT_MAP = {
  positive: { icon: "🙂", cls: "positive" }, negative: { icon: "😤", cls: "negative" },
  neutral: { icon: "😐", cls: "neutral" }, frustrated: { icon: "😠", cls: "frustrated" },
  angry: { icon: "🤬", cls: "angry" },
};

function getInitials(str = "") {
  return str.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function getSLADisplay(dateStr) {
  if (!dateStr) return { text: "No SLA", state: "safe" };
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return { text: "Breached", state: "breached" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h < 1) return { text: `${m}m left`, state: "warning" };
  return { text: `${h}h ${m}m`, state: "safe" };
}
function urgencyLevel(u = "") {
  const l = (u || "").toLowerCase();
  if (l.includes("high")) return "high";
  if (l.includes("medium")) return "medium";
  return "low";
}

/* ─── Avatar color palette ─── */
const AVATAR_PALETTES = [
  { bg: "#e0e7ff", color: "#4f46e5" },
  { bg: "#dcfce7", color: "#15803d" },
  { bg: "#fce7f3", color: "#9d174d" },
  { bg: "#fef3c7", color: "#92400e" },
  { bg: "#ccfbf1", color: "#0f766e" },
  { bg: "#dbeafe", color: "#1d4ed8" },
];
function avatarColor(name = "") {
  const idx = name.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] || AVATAR_PALETTES[0];
}

export default function InboxCard({ rec, similarCount = 0, onClick, onResolve, onEscalate, onAssign, onSnooze }) {
  const [actionsVisible, setActionsVisible] = useState(false);
  const lvl = urgencyLevel(rec.urgency);
  const sla = getSLADisplay(rec.sla_due);
  const subject = rec.subject || rec.email?.slice(0, 55) || "No Subject";
  const sender  = rec.sender  || "Unknown Sender";
  const deptColor = DEPT_COLORS[rec.team] || { bg: "#f3f5f9", color: "#374151" };
  const statusCfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.new;
  const sentiment = SENTIMENT_MAP[(rec.sentiment || "").toLowerCase()] || SENTIMENT_MAP.neutral;
  const avatarPal = avatarColor(sender);
  const isResolved = rec.status === "resolved";

  const stop = (e, fn) => { e.stopPropagation(); fn && fn(); };

  return (
    <div
      className={`ic-card urgency-border-${lvl} ${!rec.read ? "ic-unread" : ""} ${isResolved ? "ic-resolved" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setActionsVisible(true)}
      onMouseLeave={() => setActionsVisible(false)}
    >
      {/* Urgency accent bar */}
      <div className={`ic-urgency-bar urgency-bar-${lvl}`} />

      <div className="ic-inner">
        {/* Row 1 — sender + time */}
        <div className="ic-row1">
          <div className="ic-avatar-sender">
            <div className="ic-avatar" style={{ background: avatarPal.bg, color: avatarPal.color }}>
              {getInitials(sender)}
            </div>
            <div>
              <div className="ic-sender">{sender.split("<")[0].trim()}</div>
              <div className="ic-subject">{subject}</div>
            </div>
          </div>
          <div className="ic-row1-right">
            <span className="ic-time">{timeAgo(rec.createdAt)}</span>
            {!rec.read && <span className="ic-unread-dot" />}
          </div>
        </div>

        {/* Preview */}
        <div className="ic-preview">
          {rec.summary || rec.email?.slice(0, 110)}
        </div>

        {/* Row 2 — classification badges */}
        <div className="ic-badges-row">
          <span className="ic-cat-badge">
            {CATEGORY_ICONS[rec.category] || "🏷️"} {rec.category}
          </span>
          <span className={`urgency-tag ${lvl}`}>{lvl.toUpperCase()}</span>
          <span className={`sentiment-badge ${sentiment.cls}`}>{sentiment.icon} {rec.sentiment || "Neutral"}</span>
          {similarCount > 0 && (
            <span className="ic-duplicate-badge">🔁 {similarCount} similar</span>
          )}
        </div>

        {/* Row 3 — routing + SLA + status */}
        <div className="ic-routing-row">
          <div className="ic-routing-left">
            <span className="ic-arrow">→</span>
            <span className="ic-team-badge" style={{ background: deptColor.bg, color: deptColor.color }}>
              {rec.team || "Unassigned"}
            </span>
            {rec.recommended_member && (
              <span className="ic-assignee-badge">
                <span className="ic-assignee-avatar">{getInitials(rec.recommended_member)}</span>
                {rec.recommended_member.split(" ")[0]}
              </span>
            )}
          </div>
          <div className="ic-routing-right">
            <span className={`sla-timer ${sla.state}`}>⏳ {sla.text}</span>
            <span
              className="ic-status-chip"
              style={{ background: statusCfg.bg, color: statusCfg.color, borderColor: statusCfg.color + "30" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusCfg.color, display: "inline-block" }} />
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Row 4 — quick actions (hover) */}
        <div className={`ic-quick-actions ${actionsVisible ? "visible" : ""}`}>
          <button className="ic-btn ic-btn-open"     onClick={e => stop(e, onClick)}>🔍 Open</button>
          <button className="ic-btn ic-btn-assign"   onClick={e => stop(e, () => onAssign && onAssign(rec._id, rec.recommended_member))}>👥 Assign</button>
          <button className="ic-btn ic-btn-escalate" onClick={e => stop(e, () => onEscalate && onEscalate(rec._id))}>⬆️ Escalate</button>
          <button
            className={`ic-btn ${isResolved ? "ic-btn-reopen" : "ic-btn-resolve"}`}
            onClick={e => stop(e, () => onResolve && onResolve(rec._id, rec.status || "new"))}
          >
            {isResolved ? "↩️ Reopen" : "✅ Resolve"}
          </button>
        </div>
      </div>
    </div>
  );
}
