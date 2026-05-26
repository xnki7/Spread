import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand.js";
import { useAuth } from "../lib/auth.js";

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(email, password);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <nav className="nav">
        <Link to="/"><Brand /></Link>
        <div className="nav-cta">
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Already have one?</span>
          <Link to="/login" className="btn btn-ghost">Log in</Link>
        </div>
      </nav>

      <div className="auth-shell">
        <form className="auth-card" onSubmit={onSubmit}>
          <h1>Create your account</h1>
          <p className="sub">$5,000 of paper money to play with</p>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
            <span className="hint">Use 8 or more characters. Mix letters, numbers and symbols.</span>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>

          <div className="auth-foot">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Spread</span>
        <span>Paper trading only.</span>
      </footer>
    </div>
  );
}
