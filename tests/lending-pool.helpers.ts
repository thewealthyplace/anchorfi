import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
export const deployer = accounts.get("deployer")!;
export const wallet1 = accounts.get("wallet_1")!;
export const wallet2 = accounts.get("wallet_2")!;

export const STX_PRICE = 2_000_000;
export const COLLATERAL = 1_000_000_000; // 1000 STX in microSTX
export const BORROW_AMOUNT = 1_000_000_000; // $1000 aUSD

export function setupProtocol() {
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

export function repayLoan(borrower = wallet1, amount = BORROW_AMOUNT) {
  return simnet.callPublicFn("lending-pool", "repay", [Cl.uint(amount)], borrower);
}

export function liquidateLoan(borrower = wallet1, liquidator = wallet2) {
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

export function getMaxBorrow(collateral = COLLATERAL) {
  return simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(collateral)], deployer);
}

export function getHealthFactor(borrower = wallet1) {
  return simnet.callReadOnlyFn("lending-pool", "get-health-factor", [Cl.principal(borrower)], deployer);
}
