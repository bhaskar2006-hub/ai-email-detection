/* ──────────────────────────────────────────────────────────────
   HistoryPage.jsx  —  Support Triage Copilot
──────────────────────────────────────────────────────────────── */

const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};
const STATUS_CONFIG = {
  new:         { label: "New",         color: "#6366f1", bg: "#eff2ff" },
  assigned:    { label: "Assigned",    color: "#0ea5e9", bg: "#e0f2fe" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "#fffbeb" },
  escalated:   { label: "Escalated",   color: "#ef4444", bg: "#fef2f2" },
  resolved:    { label: "Resolved",    color: "#22c55e", bg: "#f0fdf4" },
  snoozed:     { label: "Snoozed",     color: "#8b5cf6", bg: "#f5f3ff" },
  pending:     { label: "Pending",     color: "#94a3b8", bg: "#f8fafc" },
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
function getSLADisplay(dateStr) {
  if (!dateStr) return { text: "No SLA", state: "safe" };
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return { text: "Breached", state: "breached" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h < 1) return { text: `${m}m left`, state: "warning" };
  return { text: `${h}h ${m}m`, state: "safe" };
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function ConfidenceBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-track">
        <div className="confidence-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="confidence-label" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function HistoryPage({
  history, filterStatus, setFilterStatus,
  onRowClick, onToggleStatus, onDelete, onReassign,
  onEscalate, fetchHistory, handleExportCSV,
  reassignId, setReassignId,
}) {
  const TEAMS = ["Engineering", "Finance", "Product", "Support", "Customer Success"];
  const ALL_STATUSES = Object.keys(STATUS_CONFIG);

  const filtered = history.filter(r => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus || (!r.status && filterStatus === "new");
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>History</h1>
          <p className="page-subtitle">All {filtered.length} analyzed tickets — click any row to open detail</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="clear-btn" onClick={handleExportCSV}>📥 Export CSV</button>
          <button className="clear-btn" onClick={fetchHistory}>🔄 Refresh</button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="filter-bar" style={{ marginBottom: 0 }}>
        <button className={`filter-btn ${filterStatus === "all" ? "active" : ""}`} onClick={() => setFilterStatus("all")}>
          All ({history.length})
        </button>
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = history.filter(r => r.status === s || (!r.status && s === "new")).length;
          return (
            <button
              key={s}
              className={`filter-btn ${filterStatus === s ? "active" : ""}`}
              style={filterStatus === s ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color + "50" } : {}}
              onClick={() => setFilterStatus(s)}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty-result" style={{ padding: 40 }}>
            <div className="empty-icon">📂</div>
            <p>No tickets with this status.</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Subject / Sender</th>
                <th>Category</th>
                <th>Urgency / SLA</th>
                <th>Team / Assignee</th>
                <th>Confidence</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const lvl  = urgencyLevel(row.urgency);
                const sla  = getSLADisplay(row.sla_due);
                const subj = row.subject || extractSubject(row.email);
                const sndr = row.sender  || extractSender(row.email);
                const sCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.new;
                return (
                  <tr key={row._id} className="history-row-clickable" onClick={() => onRowClick(row)}>
                    <td style={{ maxWidth: 260 }}>
                      <strong>{subj}</strong>
                      <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                        <span className="ic-status-chip" style={{ background: sCfg.bg, color: sCfg.color, borderColor: sCfg.color + "30" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.color, display: "inline-block" }} />
                          {sCfg.label}
                        </span>
                        {sndr && <span style={{ fontSize: 11, color: "#9ca3af" }}>{sndr.slice(0, 28)}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="ic-cat-badge">{CATEGORY_ICONS[row.category] || "🏷️"} {row.category}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <span className={`urgency-tag ${lvl}`}>{lvl.toUpperCase()}</span>
                        <span className={`sla-timer ${sla.state}`}>⏳ {sla.text}</span>
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {reassignId === row._id ? (
                        <div className="reassign-dropdown" style={{ left: 0 }}>
                          {TEAMS.map(t => <button key={t} className="reassign-option" onClick={() => onReassign(row._id, t)}>{t}</button>)}
                          <button className="reassign-cancel" onClick={() => setReassignId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{row.team}</span>
                          {row.recommended_member && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>👤 {row.recommended_member}</div>}
                          {row.assigned_to && <div style={{ fontSize: 11, color: "#0ea5e9", marginTop: 2 }}>✓ {row.assigned_to}</div>}
                        </div>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <ConfidenceBar score={row.confidence_score} />
                    </td>
                    <td className="time-ago">{timeAgo(row.createdAt)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button className="action-btn reassign-btn" onClick={() => onToggleStatus(row._id, row.status || "new")} title={row.status === "resolved" ? "Reopen" : "Resolve"}>
                          {row.status === "resolved" ? "↩️" : "✅"}
                        </button>
                        <button className="action-btn reassign-btn" onClick={() => onEscalate(row._id)} title="Escalate">⬆️</button>
                        <button className="action-btn reassign-btn" onClick={() => setReassignId(reassignId === row._id ? null : row._id)} title="Reassign">👥</button>
                        <button className="action-btn delete-btn" onClick={() => onDelete(row._id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
