import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand.js";
import { useAuth } from "../lib/auth.js";

export function Login() {
  const { login } = useAuth();
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
      await login(email, password);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <nav className="nav">
        <Link to="/"><Brand /></Link>
        <div className="nav-cta">
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>New here?</span>
          <Link to="/signup" className="btn btn-ghost">Sign up</Link>
        </div>
      </nav>

      <div className="auth-shell">
        <form className="auth-card" onSubmit={onSubmit}>
          <h1>Welcome back</h1>
          <p className="sub">Sign in to continue trading</p>

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
              autoComplete="current-password"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="auth-foot">
            Don't have an account? <Link to="/signup">Create one</Link>
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
