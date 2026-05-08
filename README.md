# AnchorFi

Bitcoin-anchored lending protocol built on Stacks. Deposit STX as collateral, borrow aUSD (AnchorFi USD) against it. All logic is on-chain in Clarity smart contracts.

## Protocol Overview

| Contract | Role |
|---|---|
| `oracle` | STX/USD price feed with stale-price protection |
| `sip010-trait` | SIP-010 fungible token interface |
| `ausd-token` | aUSD — the protocol's borrowing denomination |
| `collateral-vault` | Holds user STX collateral, tracks locked vs available |
| `lending-pool` | Borrow / repay / liquidate with per-block interest |
| `liquidation` | Records liquidation history and liquidator stats |

## Key Parameters

| Parameter | Value |
|---|---|
| Max LTV | 70% |
| Liquidation threshold | 80% |
| Liquidation bonus | 10% |
| Interest rate | 0.001% per block (~5% APR) |

## Getting Started

**Requirements:** [Clarinet](https://docs.hiro.so/clarinet) ≥ 3.0, Node ≥ 18

```bash
npm install
npm test
```

## Development

```bash
# Run tests
npm test

# Check contracts
clarinet check

# Open REPL
clarinet console
```

## Deployment

```bash
./scripts/deploy.sh testnet
```

After deployment, configure contract relationships:

```bash
# 1. Authorize lending-pool in the vault
clarinet call collateral-vault set-lending-pool <lending-pool-address>

# 2. Set lending-pool as aUSD minter
clarinet call ausd-token set-minter <lending-pool-address>

# 3. Set initial STX price (6 decimal precision, e.g. $2.00 = 2000000)
clarinet call oracle set-price 2000000

# 4. Configure lending-pool with contract addresses
clarinet call lending-pool configure <oracle> <vault> <ausd>
```

## Security

- All cross-contract authorization uses `contract-caller` (not `tx-sender`)
- Oracle has stale-price protection (MAX_PRICE_AGE = 144 blocks)
- Collateral vault uses `as-contract` for safe STX transfers
- Liquidators must cover full debt before receiving collateral bonus

## License

MIT
