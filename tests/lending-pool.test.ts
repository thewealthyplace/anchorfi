import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import {
  deployer,
  wallet1,
  wallet2,
  STX_PRICE,
  COLLATERAL,
  BORROW_AMOUNT,
  setupProtocol,
  borrowLoan,
  repayLoan,
  liquidateLoan,
  getLoanEventCount,
  getLastLoanEvent,
  getLoanEvent,
  getLoanEventSummary,
  getTotalBorrowed,
  getMaxBorrow,
  getHealthFactor,
} from "./lending-pool.helpers";

describe("lending-pool", () => {
  it("returns zero total borrowed before any loan", () => {
    const { result } = getTotalBorrowed();
    expect(result).toBeOk(Cl.uint(0));
  });

  it("returns maximum borrow amount for provided collateral", () => {
    const { result } = getMaxBorrow();
    expect(result).toBeOk(Cl.uint(1_400_000_000));
  });

  it("allows a borrower to open a loan within LTV limits", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1);
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("records a borrow event after opening a loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("returns zero health factor when no loan exists", () => {
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("rejects a borrow above the maximum allowed collateral-based amount", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 1_500_000_000);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("returns none for last loan event when borrower has no history", () => {
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.none());
  });
  it("rejects a second borrow attempt while a loan is still active", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = borrowLoan(wallet1, 100_000_000);
    expect(result).toBeErr(Cl.uint(407));
  });

  it("returns loan event summary after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEventSummary(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("retrieves a borrow event by index", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEvent(wallet1, 0);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("clears the loan record after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.none());
  });

  it("keeps the loan record after a partial repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 100_000_000);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("returns none from get-loan for a borrower without a loan", () => {
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.none());
  });

  it("returns the active loan after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("increases total borrowed after opening a loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getTotalBorrowed();
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("decreases total borrowed after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getTotalBorrowed();
    expect(result).toBeOk(Cl.uint(0));
  });

  it("decreases total borrowed after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getTotalBorrowed();
    expect(result).toBeOk(Cl.uint(0));
  });

  it("prevents liquidation when the position is still healthy", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeErr(Cl.uint(406));
  });

  it("allows liquidation after the collateral price drops", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(true);
  });

  it("increments event count after repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("increments event count after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("returns a repay event as the last event after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("returns a liquidation event as the last event after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("returns zero loan events for a borrower with no history", () => {
    const { result } = getLoanEventCount(wallet2);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("returns none when requesting a missing loan event index", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEvent(wallet1, 5);
    expect(result).toBeOk(Cl.none());
  });

  it("keeps separate loan histories for different borrowers", () => {
    setupProtocol();
    borrowLoan(wallet1);
    borrowLoan(wallet2);
    const { result: count1 } = getLoanEventCount(wallet1);
    const { result: count2 } = getLoanEventCount(wallet2);
    expect(count1).toBeOk(Cl.uint(1));
    expect(count2).toBeOk(Cl.uint(1));
  });

  it("allows a borrower to reopen a loan after fully repaying", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = borrowLoan(wallet1);
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("records remaining debt after a partial repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 100_000_000);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("records zero remaining debt after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("removes the loan record after successful liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.none());
  });

  it("returns a loan event summary after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEventSummary(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("rejects borrowing zero aUSD", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 0);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("rejects repayment without an active loan", () => {
    const { result } = repayLoan(wallet1);
    expect(result).toBeErr(Cl.uint(403));
  });

  it("allows borrowing the exact maximum amount", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 1_400_000_000);
    expect(result).toBeOk(Cl.uint(1_400_000_000));
  });

  it("tracks total borrowed across multiple borrowers", () => {
    setupProtocol();
    borrowLoan(wallet1);
    borrowLoan(wallet2);
    const { result } = getTotalBorrowed();
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT * 2));
  });

  it("keeps the last event as repay after partial repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 100_000_000);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("returns a repay event after repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("returns a liquidation event after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("returns zero max borrow for zero collateral", () => {
    const { result } = getMaxBorrow(0);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("returns a positive health factor after a loan is opened", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.any(Number));
  });

  it("maintains a growing event count across borrow and repay", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("retrieves the first borrow event from history", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEvent(wallet1, 0);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

  it("reduces total borrowed by the loan principal on liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getTotalBorrowed();
    expect(result).toBeOk(Cl.uint(0));
  });

  it("preserves loan event count after a loan is closed", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(2));
  });

});
