import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setErrorMsg(error.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (error) {
      setErrorMsg(error.message || "An error occurred during Google authentication.");
    }
  };

  return (
    <div className="login-screen" style={{
      display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "var(--bg-color)"
    }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 40, textAlign: "center" }}>
        
        {/* Logo/Header */}
        <div className="nav-logo-icon" style={{ width: 56, height: 56, fontSize: 22, borderRadius: 16, margin: "0 auto 24px" }}>TC</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0", color: "var(--text-color)", letterSpacing: "-0.5px" }}>
          {isSignUp ? "Create an Account" : "Welcome Back"}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 32px 0" }}>
          {isSignUp ? "Sign up to access your Triage Copilot." : "Enter your credentials to access your dashboard."}
        </p>

        {/* Status Messages */}
        {errorMsg && (
          <div style={{ backgroundColor: "#fef2f2", color: "#b91c1c", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", border: "1px solid #fecaca", textAlign: "left" }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: "#f0fdf4", color: "#15803d", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", border: "1px solid #bbf7d0", textAlign: "left" }}>
            {successMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-field" style={{ textAlign: "left" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Email Address</label>
            <input 
              type="email" 
              className="field-input" 
              style={{ width: "100%", padding: "12px 16px" }}
              placeholder="you@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-field" style={{ textAlign: "left" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Password</label>
            <input 
              type="password" 
              className="field-input" 
              style={{ width: "100%", padding: "12px 16px" }}
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button 
            type="submit" 
            className="analyze-btn" 
            style={{ marginTop: 8, height: 44, justifyContent: "center" }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : (isSignUp ? "Sign Up" : "Sign In")}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }}></div>
          <span style={{ margin: "0 16px", fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }}></div>
        </div>

        <button 
          type="button" 
          onClick={handleGoogleSignIn}
          style={{ 
            width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            backgroundColor: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: 16, height: 16 }} />
          Sign in with Google
        </button>

        {/* Toggle Mode */}
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 24 }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button 
            type="button" 
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(""); setSuccessMsg(""); }}
            style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 600, padding: 0, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
