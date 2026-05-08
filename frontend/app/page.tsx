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

function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-24">

      {/* Hero */}
      <section className="space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-3 py-1 text-xs text-[#f7931a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f7931a]" />
          Built on Stacks · Secured by Bitcoin
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-white leading-tight max-w-2xl">
          Bitcoin-anchored lending, fully on-chain
        </h1>
        <p className="text-lg text-[#8b949e] max-w-xl leading-relaxed">
          Deposit STX as collateral, borrow aUSD against it. Every rule — interest, liquidations,
          collateral ratios — lives in Clarity smart contracts with Bitcoin finality.
        </p>
        <div className="flex gap-4 pt-2">
          <a
            href="https://github.com/thewealthyplace/anchorfi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 transition-colors"
          >
            <GitHubIcon className="text-black" />
            GitHub
          </a>
          <a
            href="https://github.com/thewealthyplace/anchorfi/tree/main/contracts"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[#30363d] px-5 py-2.5 text-sm font-medium text-[#e8eaf0] hover:border-[#8b949e] transition-colors"
          >
            View Contracts
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {params.map((p) => (
          <div key={p.label} className="rounded-xl border border-[#21262d] bg-[#0d1117] p-5 space-y-1">
            <p className="text-xs text-[#8b949e] uppercase tracking-wider">{p.label}</p>
            <p className="text-2xl font-semibold text-white">{p.value}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="space-y-10">
        <div>
          <h2 className="text-2xl font-semibold text-white">How it works</h2>
          <p className="mt-2 text-[#8b949e]">Three steps, all on-chain.</p>
        </div>
      </section>

      {/* Nav */}
      <nav className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight text-white">AnchorFi</span>
        <a
          href="https://github.com/thewealthyplace/anchorfi"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-[#8b949e] hover:text-white transition-colors"
        >
          <GitHubIcon />
          View on GitHub
        </a>
      </nav>

    </main>
  );
}
