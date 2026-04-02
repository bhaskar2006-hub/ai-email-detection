/* ──────────────────────────────────────────────────────────────
   FilterBar.jsx  —  Support Triage Copilot
   Smart filter bar with search + chip group filters
──────────────────────────────────────────────────────────────── */

const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};

const STATUS_CONFIG = {
  new:         { label: "New",         color: "#6366f1" },
  assigned:    { label: "Assigned",    color: "#0ea5e9" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  escalated:   { label: "Escalated",   color: "#ef4444" },
  resolved:    { label: "Resolved",    color: "#22c55e" },
  snoozed:     { label: "Snoozed",     color: "#8b5cf6" },
};

const DEFAULT_FILTERS = { search: "", category: "All", urgency: "All", status: "All", sla: "All" };

export { DEFAULT_FILTERS };

export default function FilterBar({ filters, onChange }) {
  const isActive = filters.category !== "All" || filters.urgency !== "All" ||
    filters.status !== "All" || filters.sla !== "All" || filters.search;

  return (
    <div className="filterbar">
      {/* Search */}
      <div className="fb-search">
        <span className="fb-search-icon">🔍</span>
        <input
          className="fb-search-input"
          placeholder="Search by subject, sender, category, team…"
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
        />
        {filters.search && (
          <button className="fb-clear-x" onClick={() => onChange({ ...filters, search: "" })}>×</button>
        )}
      </div>

      {/* Filter chip groups */}
      <div className="fb-groups">
        {/* Category */}
        <div className="fb-group">
          <span className="fb-group-label">Category</span>
          <div className="fb-chips">
            {["All", "Billing", "Bug", "Feature Request", "General Query", "Account Access", "Refund"].map(cat => (
              <button
                key={cat}
                className={`fb-chip ${filters.category === cat ? "fb-chip-active" : ""}`}
                onClick={() => onChange({ ...filters, category: cat })}
              >
                {cat !== "All" && CATEGORY_ICONS[cat]} {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div className="fb-group">
          <span className="fb-group-label">Urgency</span>
          <div className="fb-chips">
            {[
              { v: "All",    label: "All",    color: "" },
              { v: "High",   label: "🔴 High",   color: "#dc2626" },
              { v: "Medium", label: "🟡 Medium",  color: "#d97706" },
              { v: "Low",    label: "🟢 Low",    color: "#16a34a" },
            ].map(({ v, label, color }) => (
              <button
                key={v}
                className={`fb-chip ${filters.urgency === v ? "fb-chip-active" : ""}`}
                style={filters.urgency === v && color ? { borderColor: color, color, background: color + "18" } : {}}
                onClick={() => onChange({ ...filters, urgency: v })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="fb-group">
          <span className="fb-group-label">Status</span>
          <div className="fb-chips">
            <button className={`fb-chip ${filters.status === "All" ? "fb-chip-active" : ""}`} onClick={() => onChange({ ...filters, status: "All" })}>All</button>
            {Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => (
              <button
                key={key}
                className={`fb-chip ${filters.status === key ? "fb-chip-active" : ""}`}
                style={filters.status === key ? { borderColor: color, color, background: color + "18" } : {}}
                onClick={() => onChange({ ...filters, status: key })}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", marginRight: 4 }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* SLA */}
        <div className="fb-group">
          <span className="fb-group-label">SLA</span>
          <div className="fb-chips">
            {[
              { v: "All",      label: "All" },
              { v: "Breached", label: "🔴 Breached" },
              { v: "Warning",  label: "🟡 Warning" },
              { v: "Safe",     label: "🟢 On Track" },
            ].map(({ v, label }) => (
              <button
                key={v}
                className={`fb-chip ${filters.sla === v ? "fb-chip-active" : ""}`}
                onClick={() => onChange({ ...filters, sla: v })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clear all */}
      {isActive && (
        <button className="fb-clear-all" onClick={() => onChange(DEFAULT_FILTERS)}>
          ✕ Clear all filters
        </button>
      )}
    </div>
  );
}
