/* ──────────────────────────────────────────────────────────────
   AnalyticsPage.jsx  —  Support Triage Copilot
──────────────────────────────────────────────────────────────── */

const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};
const DEPT_COLORS = {
  Engineering: { color: "#1d4ed8" }, Finance: { color: "#15803d" },
  Product: { color: "#7c3aed" }, Support: { color: "#92400e" },
};

export default function AnalyticsPage({ stats, duplicateGroupCount, fetchStats, addToast }) {
  if (!stats) {
    return (
      <div className="empty-result">
        <div className="empty-icon">📊</div>
        <p>No analytics data yet. Analyze some emails to see insights.</p>
      </div>
    );
  }

  const urgentUnresolved = stats.urgency?.high - (stats.resolvedCount || 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-subtitle">Real-time triage intelligence — {stats.total} emails processed</p>
        </div>
        <button className="clear-btn" onClick={() => { fetchStats(); addToast("Stats refreshed!"); }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Summary Alert Widgets ── */}
      <div className="summary-widgets-row">
        <SummaryWidget
          icon="🔴"
          label="Urgent Unresolved"
          value={Math.max(0, (stats.urgency?.high || 0) - (stats.resolvedCount || 0))}
          desc="High priority · needs action"
          accent="#dc2626"
          accentBg="#fef2f2"
        />
        <SummaryWidget
          icon="⚠️"
          label="SLA Breached"
          value={stats.breachedCount || 0}
          desc="Past due date · overdue"
          accent="#f59e0b"
          accentBg="#fffbeb"
        />
        <SummaryWidget
          icon="💳"
          label="Billing Issues"
          value={stats.billingCount || 0}
          desc="Billing + Refund tickets"
          accent="#15803d"
          accentBg="#dcfce7"
        />
        <SummaryWidget
          icon="🔁"
          label="Duplicate Groups"
          value={duplicateGroupCount || 0}
          desc="Similar complaint clusters"
          accent="#6366f1"
          accentBg="#eff2ff"
        />
      </div>

      {/* ── KPI Cards ── */}
      <div className="stats-row">
        {[
          { label: "Total Analyzed",   value: stats.total,               icon: "📧", color: "#2563eb" },
          { label: "New",              value: stats.newCount || 0,       icon: "🆕", color: "#6366f1" },
          { label: "Escalated",        value: stats.escalatedCount || 0, icon: "⬆️", color: "#dc2626" },
          { label: "Resolved",         value: stats.resolvedCount || 0,  icon: "✅", color: "#16a34a" },
          { label: "Avg Confidence",   value: `${stats.avgConfidence || 0}%`, icon: "🧠", color: "#7c3aed" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: `${s.color}18` }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Urgency Distribution ── */}
      <div className="urgency-distribution card">
        <h3 className="analytics-card-title">Urgency Distribution</h3>
        <div className="urgency-dist-row">
          {[
            { key: "high",   label: "High",   count: stats.urgency?.high   || 0, color: "#dc2626", bg: "#fef2f2" },
            { key: "medium", label: "Medium", count: stats.urgency?.medium || 0, color: "#d97706", bg: "#fffbeb" },
            { key: "low",    label: "Low",    count: stats.urgency?.low    || 0, color: "#16a34a", bg: "#f0fdf4" },
          ].map(u => {
            const pct = stats.total > 0 ? Math.round((u.count / stats.total) * 100) : 0;
            return (
              <div key={u.key} className="urgency-dist-box" style={{ background: u.bg, borderColor: u.color + "40" }}>
                <div className="urgency-dist-value" style={{ color: u.color }}>{u.count}</div>
                <div className="urgency-dist-label">{u.label} Priority</div>
                <div className="urgency-dist-pct" style={{ color: u.color }}>{pct}% of total</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3-col Charts ── */}
      <div className="analytics-row-3">
        {/* Sentiment */}
        <div className="card">
          <h3 className="analytics-card-title">Sentiment Analysis</h3>
          {(!stats.sentiments || stats.sentiments.length === 0) ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>No data yet.</p>
          ) : (
            stats.sentiments.map(s => {
              const pct = stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0;
              const fillColors = { Positive: "#22c55e", Negative: "#ef4444", Neutral: "#94a3b8", Frustrated: "#f59e0b", Angry: "#dc2626" };
              return (
                <div key={s.name} className="bar-item">
                  <div className="bar-header">
                    <span className="bar-name">{s.name}</span>
                    <span className="bar-count">{s.count} ({pct}%)</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: fillColors[s.name] || "#94a3b8" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Category */}
        <div className="card">
          <h3 className="analytics-card-title">Category Breakdown</h3>
          {stats.categories.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>No data yet.</p>
          ) : (
            stats.categories.map(c => {
              const pct = stats.total > 0 ? Math.round((c.count / stats.total) * 100) : 0;
              return (
                <div key={c.name} className="bar-item">
                  <div className="bar-header">
                    <span className="bar-name">{CATEGORY_ICONS[c.name] || "🏷️"} {c.name}</span>
                    <span className="bar-count">{c.count} ({pct}%)</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill blue" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Team Workload */}
        <div className="card">
          <h3 className="analytics-card-title">Team Workload</h3>
          {stats.teams.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>No data yet.</p>
          ) : (
            stats.teams.map(t => {
              const pct = stats.total > 0 ? Math.round((t.count / stats.total) * 100) : 0;
              const dc = DEPT_COLORS[t.name] || { color: "#374151" };
              return (
                <div key={t.name} className="bar-item">
                  <div className="bar-header">
                    <span className="bar-name" style={{ color: dc.color }}>{t.name}</span>
                    <span className="bar-count">{t.count} ({pct}%)</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: dc.color }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function SummaryWidget({ icon, label, value, desc, accent, accentBg }) {
  return (
    <div className="summary-widget" style={{ borderLeftColor: accent }}>
      <div className="sw-icon-wrap" style={{ background: accentBg }}>
        <span className="sw-icon">{icon}</span>
      </div>
      <div className="sw-body">
        <div className="sw-value" style={{ color: accent }}>{value}</div>
        <div className="sw-label">{label}</div>
        <div className="sw-desc">{desc}</div>
      </div>
    </div>
  );
}
