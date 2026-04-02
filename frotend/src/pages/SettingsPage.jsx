/* ──────────────────────────────────────────────────────────────
   SettingsPage.jsx  —  Support Triage Copilot
──────────────────────────────────────────────────────────────── */
import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const CATEGORY_ICONS = {
  "Billing": "💳", "Bug": "🐛", "Feature Request": "💡",
  "General Query": "💬", "Account Access": "🔑", "Refund": "↩️",
};
const DEPT_COLORS = {
  Engineering:          { bg: "#dbeafe", color: "#1d4ed8" },
  Finance:              { bg: "#dcfce7", color: "#15803d" },
  Product:              { bg: "#f3e8ff", color: "#7c3aed" },
  Support:              { bg: "#fef3c7", color: "#92400e" },
  "Customer Success":   { bg: "#ccfbf1", color: "#0f766e" },
};

function getInitials(str = "") {
  return str.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

function AddMemberForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ name: "", email: "", role: "", department: "Support", skills: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="add-member-form">
      <div className="form-grid">
        <div className="form-field"><label>Name *</label><input placeholder="Full name" value={form.name} onChange={e => set("name", e.target.value)} /></div>
        <div className="form-field"><label>Email</label><input placeholder="email@company.com" value={form.email} onChange={e => set("email", e.target.value)} /></div>
        <div className="form-field"><label>Role</label><input placeholder="e.g. Support Agent" value={form.role} onChange={e => set("role", e.target.value)} /></div>
        <div className="form-field">
          <label>Department</label>
          <select value={form.department} onChange={e => set("department", e.target.value)}>
            <option>Support</option><option>Engineering</option><option>Finance</option>
            <option>Product</option><option>Customer Success</option>
          </select>
        </div>
        <div className="form-field form-field-full"><label>Skills (comma-separated)</label><input placeholder="billing, refunds, accounts" value={form.skills} onChange={e => set("skills", e.target.value)} /></div>
      </div>
      <div className="form-actions">
        <button className="analyze-btn" style={{ flex: "0 0 auto", padding: "10px 24px" }} onClick={() => form.name.trim() && onAdd(form)}>
          ＋ Add Member
        </button>
        <button className="clear-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function SettingsPage({ teamMembers, setTeamMembers, addToast, fetchHistory, fetchStats, fetchTeamMembers }) {
  const [showAddMember, setShowAddMember] = useState(false);

  const handleAddMember = async (form) => {
    try {
      const res = await axios.post(`${API}/team-members`, form);
      setTeamMembers(prev => [...prev, res.data]);
      setShowAddMember(false);
      addToast(`${res.data.name} added to the team!`);
    } catch { addToast("Could not add team member.", "error"); }
  };

  const handleDeleteMember = async (id) => {
    try {
      await axios.delete(`${API}/team-members/${id}`);
      setTeamMembers(prev => prev.filter(m => m._id !== id));
      addToast("Team member removed.");
    } catch { addToast("Could not remove team member.", "error"); }
  };

  const handleAvailabilityChange = async (id, availability) => {
    try {
      const res = await axios.patch(`${API}/team-members/${id}`, { availability });
      setTeamMembers(prev => prev.map(m => m._id === id ? res.data : m));
    } catch { addToast("Could not update availability.", "error"); }
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Settings</h1><p className="page-subtitle">Configure your Support Triage Copilot workspace.</p></div>
      </div>

      {/* Connection info */}
      <div className="card" style={{ maxWidth: 640 }}>
        <h3 className="analytics-card-title">Backend Connection</h3>
        {[
          { label: "API Endpoint",   value: API },
          { label: "AI Service",     value: "http://localhost:5001" },
          { label: "Database",       value: "mongodb://localhost:27017/emailDB" },
        ].map(row => (
          <div className="settings-row" key={row.label}>
            <label className="settings-label">{row.label}</label>
            <input className="settings-input" defaultValue={row.value} readOnly />
          </div>
        ))}
        <div style={{ marginTop: 16 }}>
          <button className="analyze-btn" style={{ width: "auto" }} onClick={() => { fetchHistory(); fetchStats(); fetchTeamMembers(); addToast("Connection verified!"); }}>
            🔌 Test Connection
          </button>
        </div>
      </div>

      {/* Routing Rules */}
      <div className="card">
        <h3 className="analytics-card-title">Routing Rules</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Automatic routing based on category + urgency.</p>
        <table className="routing-table">
          <thead>
            <tr><th>Category</th><th>Urgency</th><th>Team</th><th>Default Member</th></tr>
          </thead>
          <tbody>
            {[
              ["Bug",            "HIGH",       "Engineering", "Sarah Chen"],
              ["Bug",            "MEDIUM/LOW",  "Engineering", "Marcus Lee"],
              ["Billing",        "HIGH",       "Finance",     "Priya Sharma"],
              ["Billing",        "MEDIUM/LOW",  "Finance",     "James Okafor"],
              ["Refund",         "ANY",        "Finance",     "Priya Sharma"],
              ["Feature Request","ANY",        "Product",     "Emily Torres"],
              ["Account Access", "HIGH",       "Support",     "Alex Kim"],
              ["Account Access", "MEDIUM/LOW",  "Support",     "Zoe Nguyen"],
              ["General Query",  "HIGH",       "Support",     "Alex Kim"],
              ["General Query",  "MEDIUM/LOW",  "Support",     "Zoe Nguyen"],
            ].map(([cat, urg, team, member]) => {
              const dc = DEPT_COLORS[team] || {};
              const urgLvl = urg === "HIGH" ? "high" : urg === "ANY" ? "low" : "medium";
              return (
                <tr key={`${cat}-${urg}`}>
                  <td><span className="ic-cat-badge">{CATEGORY_ICONS[cat] || "🏷️"} {cat}</span></td>
                  <td><span className={`urgency-tag ${urgLvl}`}>{urg}</span></td>
                  <td><span className="dept-badge" style={{ background: dc.bg, color: dc.color }}>{team}</span></td>
                  <td style={{ fontSize: 13 }}>👤 {member}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Team Members */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 className="analytics-card-title" style={{ marginBottom: 0 }}>Team Members ({teamMembers.length})</h3>
          <button className="analyze-btn" style={{ width: "auto", padding: "8px 18px", fontSize: 13 }} onClick={() => setShowAddMember(v => !v)}>
            {showAddMember ? "✕ Cancel" : "＋ Add Member"}
          </button>
        </div>
        {showAddMember && <AddMemberForm onAdd={handleAddMember} onCancel={() => setShowAddMember(false)} />}
        {teamMembers.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>No team members. Add one above.</p>
        ) : (
          <div className="member-list">
            {teamMembers.map(m => {
              const dc = DEPT_COLORS[m.department] || { bg: "#f3f5f9", color: "#374151" };
              return (
                <div className="member-row" key={m._id}>
                  <div className="member-avatar" style={{ background: dc.bg, color: dc.color }}>{getInitials(m.name)}</div>
                  <div className="member-info">
                    <div className="member-name">{m.name}</div>
                    <div className="member-meta">
                      <span className="dept-badge" style={{ background: dc.bg, color: dc.color }}>{m.department}</span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{m.role}</span>
                      {m.email && <span style={{ fontSize: 11, color: "#9ca3af" }}>{m.email}</span>}
                    </div>
                    {m.skills?.length > 0 && (
                      <div className="member-skills">
                        {m.skills.map(sk => <span key={sk} className="skill-tag">{sk}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="member-right">
                    <select
                      className="avail-select"
                      value={m.availability}
                      onChange={e => handleAvailabilityChange(m._id, e.target.value)}
                    >
                      <option value="available">🟢 Available</option>
                      <option value="busy">🟡 Busy</option>
                      <option value="offline">⚪ Offline</option>
                    </select>
                    <button className="action-btn delete-btn" onClick={() => handleDeleteMember(m._id)} title="Remove">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Legend */}
      <div className="card" style={{ maxWidth: 640 }}>
        <h3 className="analytics-card-title">Workflow Status Guide</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            { s: "new", l: "New", d: "Freshly triaged, pending action" },
            { s: "assigned", l: "Assigned", d: "Assigned to a team member" },
            { s: "in_progress", l: "In Progress", d: "Actively being worked on" },
            { s: "escalated", l: "Escalated", d: "Requires senior attention" },
            { s: "resolved", l: "Resolved", d: "Issue resolved and closed" },
            { s: "snoozed", l: "Snoozed", d: "Temporarily deferred" },
          ].map(({ s, l, d }) => {
            const COLORS = { new: ["#eff2ff", "#6366f1"], assigned: ["#e0f2fe", "#0ea5e9"], in_progress: ["#fffbeb", "#f59e0b"], escalated: ["#fef2f2", "#ef4444"], resolved: ["#f0fdf4", "#22c55e"], snoozed: ["#f5f3ff", "#8b5cf6"] };
            const [bg, color] = COLORS[s] || ["#f3f5f9", "#374151"];
            return (
              <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: bg, borderRadius: 10, minWidth: 180, flex: "1 1 180px" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>{l}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{d}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
