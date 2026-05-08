const contracts = [
  { name: "oracle", role: "STX/USD price feed with stale-price protection" },
  { name: "sip010-trait", role: "SIP-010 fungible token interface" },
  { name: "ausd-token", role: "aUSD — the protocol borrowing denomination" },
  { name: "collateral-vault", role: "Holds STX collateral, tracks locked vs available" },
  { name: "lending-pool", role: "Borrow / repay / liquidate with per-block interest" },
  { name: "liquidation", role: "Liquidation history and liquidator stats registry" },
];

const params = [
  { label: "Max LTV", value: "70%" },
  { label: "Liquidation Threshold", value: "80%" },
  { label: "Liquidation Bonus", value: "10%" },
  { label: "Interest Rate", value: "~5% APR" },
  { label: "Debt Token", value: "aUSD" },
  { label: "Collateral", value: "STX" },
];

const steps = [
  {
    n: "01",
    title: "Deposit STX",
    desc: "Lock STX into the collateral vault. Your deposit is held on-chain and never leaves the protocol without your action.",
  },
  {
    n: "02",
    title: "Borrow aUSD",
    desc: "Borrow up to 70% of your collateral value as aUSD. Interest accrues per Stacks block — fully transparent on-chain.",
  },
  {
    n: "03",
    title: "Repay & Withdraw",
    desc: "Repay aUSD at any time to unlock your collateral. Partial repayments cover interest first, then principal.",
  },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-24">
    </main>
  );
}
