export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? 24 : 28;
  return (
    <span className="brand">
      <span className="logo" style={{ width: px, height: px }}>
        <svg width={px - 10} height={px - 10} viewBox="0 0 16 16" fill="none">
          <path
            d="M2 13 L6 5 L9 9 L14 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="brand-wordmark">
        Spread<span className="dot">.</span>
      </span>
    </span>
  );
}
