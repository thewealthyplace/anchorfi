import { Cl, ResponseOkCV, UIntCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
export const deployer = accounts.get("deployer")!;
export const wallet1 = accounts.get("wallet_1")!;
export const wallet2 = accounts.get("wallet_2")!;

export const STX_PRICE = 2_000_000;
export const COLLATERAL = 1_000_000_000; // 1000 STX in microSTX
export const BORROW_AMOUNT = 1_000_000_000; // $1000 aUSD

// Extra aUSD minted per wallet so tests can repay principal + accrued interest.
// The deployer is the initial minter before set-minter hands control to lending-pool.
const INTEREST_RESERVE = 10_000_000;

export function setupProtocol() {
  // Mint interest reserve while deployer is still the minter
  simnet.callPublicFn("ausd-token", "mint",
    [Cl.uint(INTEREST_RESERVE), Cl.principal(wallet1)], deployer);
  simnet.callPublicFn("ausd-token", "mint",
    [Cl.uint(INTEREST_RESERVE), Cl.principal(wallet2)], deployer);
  simnet.callPublicFn(
    "collateral-vault",
    "set-lending-pool",
    [Cl.principal(`${deployer}.lending-pool`)],
    deployer
  );
  simnet.callPublicFn(
    "ausd-token",
    "set-minter",
    [Cl.principal(`${deployer}.lending-pool`)],
    deployer
  );
  simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
  simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
  simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet2);
}

export function borrowLoan(borrower = wallet1, amount = BORROW_AMOUNT, collateral = COLLATERAL) {
  return simnet.callPublicFn(
    "lending-pool",
    "borrow",
    [Cl.uint(amount), Cl.uint(collateral)],
    borrower
  );
}

export function repayLoan(borrower = wallet1, amount?: number) {
  if (amount !== undefined) {
    return simnet.callPublicFn("lending-pool", "repay", [Cl.uint(amount)], borrower);
  }
  // Compute exact total owed so the repay closes the loan in a single call.
  // repay() accrues interest for one additional block, so we include that here.
  const loanRaw = simnet.callReadOnlyFn("lending-pool", "get-loan",
    [Cl.principal(borrower)], deployer);
  const loanOptional = (loanRaw.result as ResponseOkCV).value as any;
  if (!loanOptional.value) {
    // No active loan — call repay with 1 so it returns ERR-NO-ACTIVE-LOAN
    return simnet.callPublicFn("lending-pool", "repay", [Cl.uint(1)], borrower);
  }
  // The clarinet SDK represents TupleCV as { type: "tuple", value: { key: { type, value } } }
  const fields = loanOptional.value.value;
  const principal = Number(fields["principal-amount"].value);
  const accrued  = Number(fields["interest-accrued"].value);
  const lastBlock = Number(fields["last-accrual-block"].value);
  const repayBlock = simnet.blockHeight + 1;
  const pending = Math.floor(principal * 10 * (repayBlock - lastBlock) / 1_000_000);
  return simnet.callPublicFn("lending-pool", "repay",
    [Cl.uint(principal + accrued + pending)], borrower);
}

export function liquidateLoan(borrower = wallet1, liquidator = borrower) {
  return simnet.callPublicFn("lending-pool", "liquidate", [Cl.principal(borrower)], liquidator);
}

export function getLoanEventCount(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(borrower)], borrower);
}

export function getLastLoanEvent(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-last-loan-event", [Cl.principal(borrower)], borrower);
}

export function getLoanEvent(borrower = wallet1, index = 0) {
  return simnet.callReadOnlyFn("lending-pool", "get-loan-event", [Cl.principal(borrower), Cl.uint(index)], borrower);
}

export function getLoanEventSummary(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-loan-event-summary", [Cl.principal(borrower)], borrower);
}

export function getTotalBorrowed() {
  return simnet.callReadOnlyFn("lending-pool", "get-total-borrowed", [], deployer);
}

export function getMaxBorrow(collateral = COLLATERAL, price = STX_PRICE) {
  simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
  return simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(collateral)], deployer);
}

export function getHealthFactor(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-health-factor", [Cl.principal(borrower)], deployer);
}

export function getTotalDebt(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-total-debt", [Cl.principal(borrower)], deployer);
}

export function getEstimatedInterest(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-estimated-interest", [Cl.principal(borrower)], deployer);
}

export function isLiquidatable(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "is-liquidatable", [Cl.principal(borrower)], deployer);
}

export function getCollateralRatio(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-collateral-ratio", [Cl.principal(borrower)], deployer);
}

export function getBorrowerSnapshot(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-borrower-snapshot", [Cl.principal(borrower)], deployer);
}

export function getSafeBorrowAmount(collateral = COLLATERAL) {
  return simnet.callReadOnlyFn("lending-pool", "get-safe-borrow-amount", [Cl.uint(collateral)], deployer);
}

export function getLiquidationPrice(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-liquidation-price", [Cl.principal(borrower)], deployer);
}

export function getInterestRateInfo() {
  return simnet.callReadOnlyFn("lending-pool", "get-interest-rate-info", [], deployer);
}
