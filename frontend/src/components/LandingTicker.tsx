const TICKER = [
  { sym: "BTC", price: "67,524.10", change: 1.42 },
  { sym: "ETH", price: "3,418.75", change: 2.18 },
  { sym: "SOL", price: "164.32", change: -0.84 },
  { sym: "BNB", price: "598.40", change: 0.31 },
  { sym: "XRP", price: "0.5128", change: -1.21 },
  { sym: "DOGE", price: "0.1623", change: 3.07 },
  { sym: "ADA", price: "0.4421", change: -0.52 },
  { sym: "AVAX", price: "37.18", change: 1.85 },
  { sym: "LINK", price: "14.92", change: -2.41 },
  { sym: "MATIC", price: "0.7218", change: 0.94 },
  { sym: "DOT", price: "7.13", change: -1.07 },
  { sym: "TON", price: "5.84", change: 4.12 },
];

export function LandingTicker() {
  const items = [...TICKER, ...TICKER]; // duplicate for seamless loop
  return (
    <div className="ticker">
      <div className="ticker-track">
        {items.map((t, i) => (
          <span key={`${t.sym}-${i}`} className="ticker-pill">
            <span className="ticker-sym">{t.sym}</span>
            <span className="ticker-price mono">${t.price}</span>
            <span className={`ticker-change ${t.change >= 0 ? "up" : "down"} mono`}>
              {t.change >= 0 ? "+" : ""}{t.change.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
