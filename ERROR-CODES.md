# Error Code Reference

## Oracle Contract (100-199)
| Code | Constant | Description |
|------|----------|-------------|
| 100 | ERR-NOT-OWNER | Caller is not the contract owner |
| 101 | ERR-INVALID-PRICE | Price must be greater than zero |
| 102 | ERR-STALE-PRICE | Price has not been updated within MAX_PRICE_AGE blocks |

## aUSD Token (200-299)
| Code | Constant | Description |
|------|----------|-------------|
| 200 | ERR-NOT-AUTHORIZED | Caller is not the minter or owner |
| 201 | ERR-NOT-TOKEN-OWNER | Caller does not own the tokens being transferred |
| 202 | ERR-INSUFFICIENT-BALANCE | Token balance is insufficient |

## Collateral Vault (300-399)
| Code | Constant | Description |
|------|----------|-------------|
| 300 | ERR-NOT-AUTHORIZED | Caller is not the contract owner or lending pool |
| 301 | ERR-ZERO-AMOUNT | Amount must be greater than zero |
| 302 | ERR-INSUFFICIENT-BALANCE | Vault balance is insufficient |
| 303 | ERR-LOCKED-COLLATERAL | Cannot withdraw locked collateral |
| 304 | ERR-VAULT-NOT-FOUND | No vault exists for this principal |

## Lending Pool (400-408)
| Code | Constant | Description |
|------|----------|-------------|
| 400 | ERR-NOT-AUTHORIZED | Caller is not the contract owner |
| 401 | ERR-ZERO-AMOUNT | Amount must be greater than zero |
| 402 | ERR-INSUFFICIENT-COLLATERAL | Collateral below minimum requirement |
| 403 | ERR-NO-ACTIVE-LOAN | No active loan for this borrower |
| 404 | ERR-OVERPAYMENT | Repayment exceeds total owed |
| 405 | ERR-ORACLE-ERROR | Oracle price fetch failed |
| 406 | ERR-HEALTHY-POSITION | Position is above liquidation threshold |
| 407 | ERR-ACTIVE-LOAN | Borrower already has an active loan |
| 408 | ERR-NO-LIQUIDATION-CONTRACT | Liquidation registry not configured |

## Liquidation Registry (500-599)
| Code | Constant | Description |
|------|----------|-------------|
| 500 | ERR-NOT-AUTHORIZED | Caller is not the contract owner |
| 501 | ERR-ALREADY-REGISTERED | Already registered (unused) |
| 502 | ERR-NOT-REGISTERED | Not registered (unused) |
