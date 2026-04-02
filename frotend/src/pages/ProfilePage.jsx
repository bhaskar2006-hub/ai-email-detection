import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function ProfilePage({ session }) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (session && session.user) {
      const meta = session.user.user_metadata || {};
      setFullName(meta.full_name || "");
      setRole(meta.role || "");
      setCompany(meta.company || "");
      setPhone(meta.phone || "");
    }
  }, [session]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          role,
          company,
          phone
        }
      });

      if (error) throw error;
      
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to update profile." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "var(--text-color)" }}>Personal Profile</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>Update your personal details and preferences.</p>

      {message.text && (
        <div style={{ 
          backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2", 
          color: message.type === "success" ? "#15803d" : "#b91c1c", 
          padding: "16px", borderRadius: "8px", fontSize: "14px", marginBottom: "24px", 
          border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}` 
        }}>
          {message.type === "error" ? "⚠️ " : "✅ "}
          {message.text}
        </div>
      )}

      <div className="card" style={{ padding: 32 }}>
        <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          <div className="form-field">
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>Email Address</label>
            <input 
              type="email" 
              className="field-input" 
              style={{ width: "100%", padding: "12px 16px", backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
              value={session?.user?.email || ""}
              disabled 
            />
            <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, display: "block" }}>Email address cannot be changed.</span>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>Full Name</label>
              <input 
                type="text" 
                className="field-input" 
                style={{ width: "100%", padding: "12px 16px" }}
                placeholder="Jane Doe" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>Role / Title</label>
              <input 
                type="text" 
                className="field-input" 
                style={{ width: "100%", padding: "12px 16px" }}
                placeholder="Support Lead" 
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>Company / Department</label>
              <input 
                type="text" 
                className="field-input" 
                style={{ width: "100%", padding: "12px 16px" }}
                placeholder="Acme Corp" 
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>Phone Number</label>
              <input 
                type="tel" 
                className="field-input" 
                style={{ width: "100%", padding: "12px 16px" }}
                placeholder="+1 (555) 000-0000" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 24, marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button 
              type="submit" 
              className="analyze-btn" 
              style={{ height: 44, padding: "0 32px" }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
