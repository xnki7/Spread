import { useState } from "react";
import { PositionsTab } from "./PositionsTab.js";
import { HistoryTab } from "./HistoryTab.js";
import { WalletTab } from "./WalletTab.js";
import type { PositionSnapshotItem } from "../lib/types.js";

type Tab = "positions" | "history" | "wallet";

type Props = {
  snapshot: PositionSnapshotItem[] | null;
  reloadKey: number;
  onChange?: () => void;
  onManualClose?: (id: string) => void;
};

export function BottomPanel({ snapshot, reloadKey, onChange, onManualClose }: Props) {
  const [active, setActive] = useState<Tab>("positions");
  const openCount = snapshot?.length ?? 0;

  return (
    <div className="bottom-panel">
      <div className="bottom-tabs">
        <TabBtn
          active={active === "positions"}
          onClick={() => setActive("positions")}
        >
          Positions{openCount > 0 ? ` · ${openCount}` : ""}
        </TabBtn>
        <TabBtn
          active={active === "history"}
          onClick={() => setActive("history")}
        >
          History
        </TabBtn>
        <TabBtn
          active={active === "wallet"}
          onClick={() => setActive("wallet")}
        >
          Wallet
        </TabBtn>
      </div>
      <div className="bottom-tab-body">
        {active === "positions" && (
          <PositionsTab
            snapshot={snapshot}
            onChange={onChange}
            onManualClose={onManualClose}
          />
        )}
        {active === "history" && <HistoryTab reloadKey={reloadKey} />}
        {active === "wallet" && (
          <WalletTab snapshot={snapshot} reloadKey={reloadKey} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`bottom-tab ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
