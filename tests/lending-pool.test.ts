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
});
