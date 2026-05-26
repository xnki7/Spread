import { Link } from "react-router-dom";
import { Brand } from "../components/Brand.js";
import { LandingChart } from "../components/LandingChart.js";
import { LandingTicker } from "../components/LandingTicker.js";

const features = [
  {
    title: "Real-time prices",
    body: "Direct from Binance. Sub-second WebSocket ticks streamed straight to your chart.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    title: "Pro charts",
    body: "TradingView-grade candles, volume, crosshair. Built for traders who actually read charts.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="9" width="4" height="11" rx="1" />
        <rect x="10" y="5" width="4" height="15" rx="1" />
        <rect x="17" y="12" width="4" height="8" rx="1" />
        <path d="M5 9V4M12 5V2M19 12V8" />
      </svg>
    ),
  },
  {
    title: "Leverage up to 100×",
    body: "Long or short. Margin sized in dollars, liquidation when equity hits zero. CFD-style.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </svg>
    ),
  },
  {
    title: "$5,000 to start",
    body: "Free paper money on signup. Blow it up, learn what hurts, do it again. No real capital risked.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v12M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2.5-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5" />
      </svg>
    ),
  },
];

const stats = [
  { value: "<1s", label: "Tick latency" },
  { value: "100×", label: "Max leverage" },
  { value: "$5K", label: "Starting balance" },
  { value: "24/7", label: "Markets" },
];

export function Landing() {
  return (
    <div className="landing">
      <div className="bg-grid" />
      <div className="bg-mesh" />

      <nav className="nav">
        <Brand />
        <div className="nav-cta">
          <Link to="/login" className="btn btn-ghost">Log in</Link>
          <Link to="/signup" className="btn btn-primary">Get started</Link>
        </div>
      </nav>

      <LandingTicker />

      <section className="hero hero-split">
        <div className="hero-text">
          <span className="hero-pill">
            <span className="pill-dot" />
            Live market data · Binance
          </span>
          <h1>
            Trade crypto.<br />
            <span className="accent">Risk nothing.</span>
          </h1>
          <p>
            A pro-grade paper trading terminal. Live prices, candlestick charts,
            margin, long &amp; short — with $5,000 of pretend money to learn on.
          </p>
          <div className="hero-cta">
            <Link to="/signup" className="btn btn-primary btn-lg">
              Start trading free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">I have an account</Link>
          </div>
          <div className="hero-trust">
            <span className="check">✓</span> No credit card
            <span className="check">✓</span> No real money
            <span className="check">✓</span> Cancel anytime
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-glow" />
          <LandingChart />
        </div>
      </section>

      <section className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="features-section">
        <div className="section-head">
          <span className="kicker">Built for traders</span>
          <h2>Everything you need.<br/><span className="accent-muted">Nothing you don't.</span></h2>
        </div>
        <div className="features">
          {features.map((f) => (
            <div className="feature" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <h2>Start trading in 60 seconds.</h2>
          <p>Email + password is all it takes. $5,000 is waiting.</p>
          <Link to="/signup" className="btn btn-primary btn-lg">
            Create your free account
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      <footer className="footer">
        <Brand size="sm" />
        <span>© {new Date().getFullYear()} Spread · Paper trading only · No real money is at risk</span>
      </footer>
    </div>
  );
}
