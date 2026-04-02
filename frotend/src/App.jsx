/* ──────────────────────────────────────────────────────────────
   App.jsx  —  Support Triage Copilot
   Main shell: navigation, global state, data fetching, handlers
──────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useGoogleLogin } from "@react-oauth/google";
import "./App.css";
import "./dark.css";

import TicketDrawer from "./components/TicketDrawer";
import FilterBar, { DEFAULT_FILTERS } from "./components/FilterBar";
import InboxPage from "./pages/InboxPage";
import HistoryPage from "./pages/HistoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import { supabase } from "./supabaseClient";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/* ── duplicate detection (client-side Jaccard similarity) ── */
function findSimilarMap(emails) {
  const result = {};
  for (let i = 0; i < emails.length; i++) {
    const e1 = emails[i];
    if (!e1.category || !e1.summary) continue;
    const w1 = new Set(e1.summary.toLowerCase().split(/\W+/).filter(w => w.length > 4));
    if (w1.size === 0) continue;
    for (let j = 0; j < emails.length; j++) {
      if (i === j) continue;
      const e2 = emails[j];
      if (e2.category !== e1.category || !e2.summary) continue;
      const w2 = new Set(e2.summary.toLowerCase().split(/\W+/).filter(w => w.length > 4));
      const intersection = [...w1].filter(w => w2.has(w)).length;
      const union = new Set([...w1, ...w2]).size;
      if (union > 0 && intersection / union > 0.28) {
        if (!result[e1._id]) result[e1._id] = [];
        if (!result[e1._id].includes(e2._id)) result[e1._id].push(e2._id);
      }
    }
  }
  return result;
}

/* ── Toast ── */
function Toast({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast-msg toast-${t.type}`}>
          <span>{t.type === "error" ? "⚠️" : "✅"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  /* ── navigation ── */
  const [activeTab, setActiveTab] = useState("inbox");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── analysis form ── */
  const [email, setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [sender, setSender]  = useState("");
  const [result, setResult]  = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewAnalysis, setShowNewAnalysis] = useState(false);

  /* ── data ── */
  const [history, setHistory]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  /* ── UI state ── */
  const [toasts, setToasts]       = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [darkMode, setDarkMode]   = useState(() => localStorage.getItem("theme") === "dark");
  const [filters, setFilters]     = useState(DEFAULT_FILTERS);
  const [filterStatus, setFilterStatus] = useState("all");  // history tab
  const [reassignId, setReassignId] = useState(null);
  const [search, setSearch] = useState("");

  /* ── duplicate map ── */
  const similarMap = useMemo(() => findSimilarMap(history), [history]);
  const duplicateGroupCount = useMemo(() => {
    const groups = new Set();
    Object.values(similarMap).forEach(ids => { if (ids.length > 0) groups.add(ids.sort().join(",")); });
    return groups.size;
  }, [similarMap]);

  /* ── dark mode ── */
  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  /* ── toast ── */
  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── data fetchers ── */
  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/history`);
      setHistory(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/team-members`);
      setTeamMembers(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchStats();
    fetchTeamMembers();
    const interval = setInterval(() => { fetchHistory(); fetchStats(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchHistory, fetchStats, fetchTeamMembers]);

  /* ── Gmail login ── */
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        addToast("Fetching emails from Gmail…");
        const res = await axios.post(`${API}/gmail/fetch`, { token: tokenResponse.access_token });
        if (res.data.count === 0) addToast("No unread emails found in INBOX.");
        else { addToast(`Fetched and analyzed ${res.data.count} emails!`); fetchHistory(); fetchStats(); }
      } catch { addToast("Error fetching from Gmail.", "error"); }
      finally { setLoading(false); }
    },
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  });

  /* ── Analyze ── */
  const handleAnalyze = async () => {
    if (!email.trim()) { addToast("Please paste an email first.", "error"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/process`, { email, subject, sender });
      setResult(res.data);
      setCurrentId(res.data._id);
      await fetchHistory();
      await fetchStats();
      addToast("Email analyzed and saved.");
    } catch (err) {
      addToast(err.response?.data?.error || "Could not reach backend.", "error");
    } finally { setLoading(false); }
  };

  const handleClear = () => {
    setEmail(""); setSubject(""); setSender("");
    setResult(null); setCurrentId(null);
  };

  /* ── Status change ── */
  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`${API}/history/${id}/status`, { status: newStatus });
      setHistory(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));
      if (selectedEmail?._id === id) setSelectedEmail(prev => ({ ...prev, status: newStatus }));
      await fetchStats();
      addToast(`Status → ${newStatus}`);
    } catch { addToast("Could not update status.", "error"); }
  };

  /* ── Resolve toggle ── */
  const handleResolve = async (id, currentStatus) => {
    const newStatus = currentStatus === "resolved" ? "new" : "resolved";
    await handleStatusChange(id, newStatus);
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/history/${id}`);
      setHistory(prev => prev.filter(r => r._id !== id));
      await fetchStats();
      addToast("Ticket deleted.");
    } catch { addToast("Could not delete.", "error"); }
  };

  /* ── Reassign team ── */
  const handleReassign = async (id, team) => {
    try {
      const res = await axios.patch(`${API}/history/${id}/reassign`, { team });
      setHistory(prev => prev.map(r => r._id === id ? res.data : r));
      if (selectedEmail?._id === id) setSelectedEmail(prev => ({ ...prev, team }));
      setReassignId(null);
    } catch { addToast("Could not reassign.", "error"); }
  };

  /* ── Assign person ── */
  const handleAssign = async (id, assignedTo) => {
    try {
      const res = await axios.patch(`${API}/history/${id}/assign`, { assigned_to: assignedTo });
      setHistory(prev => prev.map(r => r._id === id ? res.data : r));
      if (selectedEmail?._id === id) setSelectedEmail(prev => ({ ...prev, assigned_to: assignedTo, status: "assigned" }));
      await fetchStats();
      addToast(`Assigned to ${assignedTo || "team"}`);
    } catch { addToast("Could not assign.", "error"); }
  };

  /* ── Escalate ── */
  const handleEscalate = async (id) => {
    try {
      const res = await axios.patch(`${API}/history/${id}/escalate`);
      setHistory(prev => prev.map(r => r._id === id ? res.data : r));
      if (selectedEmail?._id === id) setSelectedEmail(prev => ({ ...prev, status: "escalated", urgency: "High" }));
      await fetchStats();
      addToast("Ticket escalated!");
    } catch { addToast("Could not escalate.", "error"); }
  };

  /* ── Snooze ── */
  const handleSnooze = async (id) => {
    try {
      const res = await axios.patch(`${API}/history/${id}/snooze`);
      setHistory(prev => prev.map(r => r._id === id ? res.data : r));
      if (selectedEmail?._id === id) setSelectedEmail(prev => ({ ...prev, status: "snoozed" }));
      await fetchStats();
      addToast("Ticket snoozed.");
    } catch { addToast("Could not snooze.", "error"); }
  };

  /* ── Merge duplicate ── */
  const handleMerge = async (id) => {
    try {
      await axios.patch(`${API}/history/${id}/status`, { status: "resolved" });
      setHistory(prev => prev.map(r => r._id === id ? { ...r, status: "resolved" } : r));
      addToast("Marked as duplicate and resolved.");
    } catch { addToast("Could not merge.", "error"); }
  };

  /* ── Export CSV ── */
  const handleExportCSV = () => {
    const headers = ["Subject", "Sender", "Category", "Urgency", "Team", "Member", "Assigned To", "Status", "Confidence", "Created"];
    const rows = history.map(r => [
      `"${(r.subject || "").replace(/"/g, "'")}"`,
      `"${(r.sender || "").replace(/"/g, "'")}"`,
      r.category || "", r.urgency || "", r.team || "",
      r.recommended_member || "", r.assigned_to || "",
      r.status || "new",
      r.confidence_score ? Math.round(r.confidence_score * 100) + "%" : "",
      r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `triage-${Date.now()}.csv`; a.click();
    addToast("CSV exported!");
  };

  /* ── open ticket drawer (also marks read) ── */
  const openTicket = useCallback((rec) => {
    setSelectedEmail(rec);
    if (!rec.read) {
      axios.patch(`${API}/history/${rec._id}/read`).catch(() => {});
      setHistory(prev => prev.map(r => r._id === rec._id ? { ...r, read: true } : r));
    }
  }, []);

  const unreadHigh  = stats?.unreadHigh ?? 0;
  const triagedPct  = stats?.triagedPercent ?? 0;

  if (authLoading) return <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "var(--bg-color)" }}><span className="spinner" /></div>;
  if (!session) return <LoginPage />;

  /* ── shared inbox search (nav bar) ── */
  const handleNavSearch = (val) => {
    setSearch(val);
    setFilters(f => ({ ...f, search: val }));
    setActiveTab("inbox");
  };

  return (
    <div className="app-shell">
      <Toast toasts={toasts} />

      {/* ── Ticket Drawer ── */}
      {selectedEmail && (
        <TicketDrawer
          ticket={selectedEmail}
          allEmails={history}
          similarIds={similarMap[selectedEmail._id] || []}
          onClose={() => setSelectedEmail(null)}
          onStatusChange={handleStatusChange}
          onAssign={handleAssign}
          onEscalate={handleEscalate}
          onResolve={handleResolve}
          onSnooze={handleSnooze}
          onDelete={handleDelete}
          onReassign={handleReassign}
          onMerge={handleMerge}
          addToast={addToast}
        />
      )}

      {/* ── Top Nav ── */}
      <nav className="top-nav">
        <a className="nav-logo" href="#" onClick={e => { e.preventDefault(); setActiveTab("inbox"); }}>
          <div className="nav-logo-icon">TC</div>
          Support Triage Copilot
        </a>
        <div className="nav-links">
          {["Inbox", "History", "Analytics", "Settings"].map(item => (
            <a
              key={item}
              className={`nav-link ${activeTab === item.toLowerCase() ? "active" : ""}`}
              href="#"
              onClick={e => { e.preventDefault(); setActiveTab(item.toLowerCase()); }}
            >
              {item}
              {item === "History" && history.length > 0 && (
                <span className="nav-count-badge">{history.length}</span>
              )}
            </a>
          ))}
        </div>
        <div className="nav-right">
          <div className="search-bar">
            <span>🔍</span>
            <input
              className="search-input"
              placeholder="Search tickets…"
              value={search}
              onChange={e => handleNavSearch(e.target.value)}
            />
            {search && <button className="fb-clear-x" style={{ marginLeft: 4 }} onClick={() => handleNavSearch("")}>×</button>}
          </div>
          <button className="nav-icon-btn" title="Notifications" onClick={() => setActiveTab("history")}>
            🔔
            {unreadHigh > 0 && <span className="bell-badge">{unreadHigh}</span>}
          </button>
          <button className="nav-icon-btn" title="Toggle Theme" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <div className="avatar" title="User Profile" onClick={() => setActiveTab("profile")} style={{ cursor: "pointer" }}>U</div>
        </div>
      </nav>

      <div className="main-body">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <p className="sidebar-label">Support Inbox</p>
          <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 600, padding: "0 8px", marginBottom: 12 }}>● AI Copilot Active</p>

          <button className="compose-btn" onClick={() => login()}>
            <span style={{ fontSize: 16 }}>📧</span>
            Connect Gmail
          </button>

          {[
            { key: "inbox",     icon: "📥", label: "Inbox",     badge: unreadHigh > 0 ? { val: unreadHigh, urgent: true } : history.length > 0 ? { val: history.length } : null },
            { key: "history",   icon: "🕐", label: "History",   badge: history.length > 0 ? { val: history.length } : null },
            { key: "analytics", icon: "📊", label: "Analytics", badge: null },
            { key: "profile",   icon: "👤", label: "Profile",   badge: null },
            { key: "settings",  icon: "⚙️", label: "Settings",  badge: null },
          ].map(({ key, icon, label, badge }) => (
            <div key={key} className={`nav-item ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>
              <span className="icon">{icon}</span>
              {label}
              {badge && (
                <span className={`sidebar-badge ${badge.urgent ? "sidebar-badge-urgent" : ""}`} style={{ marginLeft: "auto" }}>
                  {badge.val}
                </span>
              )}
            </div>
          ))}

          {/* Status mini-legend */}
          <div className="sidebar-status-legend">
            <p className="sidebar-label" style={{ marginBottom: 8 }}>Status</p>
            {[
              { s: "new",      l: "New",      c: "#6366f1" },
              { s: "assigned", l: "Assigned", c: "#0ea5e9" },
              { s: "escalated",l: "Escalated",c: "#ef4444" },
              { s: "resolved", l: "Resolved", c: "#22c55e" },
            ].map(({ s, l, c }) => (
              <div key={s} className="sidebar-status-item" onClick={() => { setFilterStatus(s); setActiveTab("history"); }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
                <span>{l}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
                  {history.filter(r => r.status === s || (!r.status && s === "new")).length}
                </span>
              </div>
            ))}
          </div>

          <div className="sidebar-spacer" />
          <div className="sidebar-bottom">
            <div className="nav-item" onClick={() => addToast("Help Center coming soon!")}>
              <span className="icon">❓</span> Help Center
            </div>
            <div className="nav-item" style={{ color: "#ef4444" }} onClick={() => supabase.auth.signOut()}>
              <span className="icon">↪️</span> Log Out
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="content-area">
          {activeTab === "inbox" && (
            <InboxPage
              history={history}
              filters={filters}
              setFilters={setFilters}
              similarMap={similarMap}
              stats={stats}
              showNewAnalysis={showNewAnalysis}
              setShowNewAnalysis={setShowNewAnalysis}
              email={email} setEmail={setEmail}
              subject={subject} setSubject={setSubject}
              sender={sender} setSender={setSender}
              loading={loading}
              result={result}
              currentId={currentId}
              handleAnalyze={handleAnalyze}
              handleClear={handleClear}
              handleReassign={handleReassign}
              onCardClick={openTicket}
              onResolve={handleResolve}
              onEscalate={handleEscalate}
              onAssign={handleAssign}
              onSnooze={handleSnooze}
              addToast={addToast}
              reassignId={reassignId}
              setReassignId={setReassignId}
            />
          )}

          {activeTab === "history" && (
            <HistoryPage
              history={history}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              onRowClick={openTicket}
              onToggleStatus={handleResolve}
              onDelete={handleDelete}
              onReassign={handleReassign}
              onEscalate={handleEscalate}
              fetchHistory={fetchHistory}
              handleExportCSV={handleExportCSV}
              reassignId={reassignId}
              setReassignId={setReassignId}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsPage
              stats={stats}
              duplicateGroupCount={duplicateGroupCount}
              fetchStats={fetchStats}
              addToast={addToast}
            />
          )}

          {activeTab === "profile" && (
            <ProfilePage session={session} />
          )}

          {activeTab === "settings" && (
            <SettingsPage
              teamMembers={teamMembers}
              setTeamMembers={setTeamMembers}
              addToast={addToast}
              fetchHistory={fetchHistory}
              fetchStats={fetchStats}
              fetchTeamMembers={fetchTeamMembers}
            />
          )}
        </main>
      </div>


    </div>
  );
}
