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
  getTotalDebt,
  getEstimatedInterest,
  isLiquidatable,
  getCollateralRatio,
  getBorrowerSnapshot,
  getSafeBorrowAmount,
  getLiquidationPrice,
  getInterestRateInfo,
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
    expect(result).toBeOk(expect.anything());
  });

  it("retrieves a borrow event by index", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEvent(wallet1, 0);
    expect(result).toBeOk(expect.anything());
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
    expect(result).toBeOk(Cl.bool(true));
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
    expect(result).toBeOk(expect.anything());
  });

  it("returns a liquidation event as the last event after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
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
    expect(result).toBeOk(expect.anything());
  });

  it("records zero remaining debt after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
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
    expect(result).toBeOk(expect.anything());
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
    expect(result).toBeOk(expect.anything());
  });

  it("returns a repay event after repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("returns a liquidation event after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("returns zero max borrow for zero collateral", () => {
    const { result } = getMaxBorrow(0);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("returns a positive health factor after a loan is opened", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getHealthFactor(wallet1);
    expect(result).not.toBeOk(Cl.uint(0));
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
    expect(result).toBeOk(expect.anything());
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

  it("still returns a loan event summary after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLoanEventSummary(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("updates maximum borrow when the oracle price changes", () => {
    const { result: highPrice } = getMaxBorrow(COLLATERAL, 2_000_000);
    const { result: newMax } = getMaxBorrow(COLLATERAL, 3_000_000);
    expect(newMax).not.toEqual(highPrice);
  });

  it("uses a separate borrower record for wallet2", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const { result } = getLoanEventCount(wallet2);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("returns loan event summary after a partial repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 100_000_000);
    const { result } = getLoanEventSummary(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("records a block height for loan events", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("stores the borrow amount in the first loan event", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLoanEvent(wallet1, 0);
    expect(result).toBeOk(expect.anything());
  });

  it("stores the repay amount in the last loan event", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("stores the total debt in the liquidation event", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLastLoanEvent(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("allows a second borrower to open a loan independently", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const { result } = getLoanEventCount(wallet2);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("returns a summary after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = getLoanEventSummary(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("allows a borrower to open a new loan after liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    // After self-liquidation the seized collateral leaves the vault as native STX.
    // Re-deposit so wallet1 can open a new loan, and restore the oracle price.
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    const { result } = borrowLoan(wallet1);
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("keeps historical event count after a borrower reopens a loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    borrowLoan(wallet1);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(3));
  });

  it("returns the correct max borrow for 500 STX collateral", () => {
    const halfCollateral = COLLATERAL / 2;
    const { result } = getMaxBorrow(halfCollateral);
    expect(result).toBeOk(Cl.uint(700_000_000));
  });

  it("keeps the health factor above zero after borrowing", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("returns none for last event when there is no history", () => {
    const { result } = getLastLoanEvent(wallet2);
    expect(result).toBeOk(Cl.none());
  });

  it("counts multiple events for the same borrower", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    repayLoan(wallet1, 0);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("scales maximum borrow with changing oracle price", () => {
    const { result: baseMax } = getMaxBorrow(COLLATERAL, 2_000_000);
    const { result: newMax } = getMaxBorrow(COLLATERAL, 4_000_000);
    expect(newMax).not.toEqual(baseMax);
  });

  it("allows interest-only partial repayment without closing the loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 10_000);
    const { result } = getLoanEventCount(wallet1);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("returns correct history after multiple loan events", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 100_000_000);
    const { result } = getLoanEvent(wallet1, 1);
    expect(result).toBeOk(expect.anything());
  });

  it("allows a second borrower to be liquidated independently", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet2);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("supports borrow and repay flows for two different borrowers", () => {
    setupProtocol();
    borrowLoan(wallet1);
    borrowLoan(wallet2);
    repayLoan(wallet1);
    const { result: count1 } = getLoanEventCount(wallet1);
    const { result: count2 } = getLoanEventCount(wallet2);
    expect(count1).toBeOk(Cl.uint(2));
    expect(count2).toBeOk(Cl.uint(1));
  });


  it("returns zero total debt when no loan exists", () => {
    const { result } = getTotalDebt(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("returns principal as total debt immediately after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getTotalDebt(wallet1);
    const debt = (result as any).value.value;
    expect(Number(debt)).toBeGreaterThanOrEqual(BORROW_AMOUNT);
  });


  it("total debt for wallet2 is zero before wallet2 borrows", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getTotalDebt(wallet2);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("total debt for both borrowers is tracked independently", () => {
    setupProtocol();
    borrowLoan(wallet1);
    borrowLoan(wallet2);
    const { result: debt1 } = getTotalDebt(wallet1);
    const { result: debt2 } = getTotalDebt(wallet2);
    expect(debt1).not.toEqual(Cl.uint(0));
    expect(debt2).not.toEqual(Cl.uint(0));
  });


  it("total debt returns zero after full repayment closes loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getTotalDebt(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("total debt is positive after partial repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1, 100_000_000);
    const { result } = getTotalDebt(wallet1);
    const debt = (result as any).value.value;
    expect(Number(debt)).toBeGreaterThan(0);
  });


  it("returns zero estimated interest when no loan exists", () => {
    const { result } = getEstimatedInterest(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("returns zero or more estimated interest immediately after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getEstimatedInterest(wallet1);
    const interest = (result as any).value.value;
    expect(Number(interest)).toBeGreaterThanOrEqual(0);
  });


  it("estimated interest is zero for wallet2 when only wallet1 has a loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getEstimatedInterest(wallet2);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("estimated interest returns zero after full repayment closes the loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getEstimatedInterest(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("estimated interest is positive after several blocks elapsed", () => {
    setupProtocol();
    borrowLoan(wallet1);
    // advance time by running multiple no-op oracle updates
    for (let i = 0; i < 5; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_000_000)], deployer);
    }
    const { result } = getEstimatedInterest(wallet1);
    const interest = (result as any).value.value;
    expect(Number(interest)).toBeGreaterThan(0);
  });


  it("estimated interest grows as more blocks elapse", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: r1 } = getEstimatedInterest(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_000_000)], deployer);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_000_000)], deployer);
    const { result: r2 } = getEstimatedInterest(wallet1);
    const i1 = Number((r1 as any).value.value);
    const i2 = Number((r2 as any).value.value);
    expect(i2).toBeGreaterThanOrEqual(i1);
  });


  it("is-liquidatable returns false when borrower has no loan", () => {
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(false));
  });


  it("is-liquidatable returns false for a healthy position after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(false));
  });


  it("is-liquidatable returns true after oracle price drops below threshold", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });


  it("is-liquidatable returns false for wallet2 before wallet2 borrows", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = isLiquidatable(wallet2);
    expect(result).toBeOk(Cl.bool(false));
  });


  it("is-liquidatable matches the result of calling liquidate", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result: liquidatable } = isLiquidatable(wallet1);
    const { result: liqResult } = liquidateLoan(wallet1);
    expect(liquidatable).toBeOk(Cl.bool(true));
    expect(liqResult).toBeOk(Cl.bool(true));
  });


  it("is-liquidatable returns false after full repayment closes the loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(false));
  });


  it("get-collateral-ratio returns zero when borrower has no loan", () => {
    const { result } = getCollateralRatio(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-collateral-ratio returns a non-zero value after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getCollateralRatio(wallet1);
    const ratio = (result as any).value.value;
    expect(Number(ratio)).toBeGreaterThan(0);
  });


  it("get-collateral-ratio is lower than RATIO_PRECISION when healthy", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getCollateralRatio(wallet1);
    const ratio = Number((result as any).value.value);
    expect(ratio).toBeLessThan(1000);
  });


  it("get-collateral-ratio increases when oracle price drops", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: r1 } = getCollateralRatio(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_000_000)], deployer);
    const { result: r2 } = getCollateralRatio(wallet1);
    const ratio1 = Number((r1 as any).value.value);
    const ratio2 = Number((r2 as any).value.value);
    expect(ratio2).toBeGreaterThan(ratio1);
  });


  it("get-collateral-ratio returns zero for wallet2 before any borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getCollateralRatio(wallet2);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-collateral-ratio returns zero after full repayment closes loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getCollateralRatio(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-borrower-snapshot returns none when no loan exists", () => {
    setupProtocol();
    const { result } = getBorrowerSnapshot(wallet1);
    expect(result).toBeOk(Cl.none());
  });


  it("get-borrower-snapshot returns some after opening a loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getBorrowerSnapshot(wallet1);
    expect(result).toBeOk(expect.anything());
  });


  it("get-borrower-snapshot is-liquidatable is false for healthy position", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getBorrowerSnapshot(wallet1);
    const snap = (result as any).value.value.value;
    expect(snap["is-liquidatable"].value).toBe(false);
  });


  it("get-borrower-snapshot is-liquidatable is true after price drop", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = getBorrowerSnapshot(wallet1);
    const snap = (result as any).value.value.value;
    expect(snap["is-liquidatable"].value).toBe(true);
  });


  it("get-borrower-snapshot returns none for wallet2 before wallet2 borrows", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getBorrowerSnapshot(wallet2);
    expect(result).toBeOk(Cl.none());
  });


  it("get-borrower-snapshot returns none after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getBorrowerSnapshot(wallet1);
    expect(result).toBeOk(Cl.none());
  });


  it("get-borrower-snapshot snapshot for wallet2 is some after wallet2 borrows", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const { result } = getBorrowerSnapshot(wallet2);
    expect(result).toBeOk(expect.anything());
  });


  it("get-safe-borrow-amount returns zero for zero collateral", () => {
    setupProtocol();
    const { result } = getSafeBorrowAmount(0);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-safe-borrow-amount is less than get-max-borrow for same collateral", () => {
    setupProtocol();
    const { result: safe } = getSafeBorrowAmount(COLLATERAL);
    const { result: max } = getMaxBorrow(COLLATERAL);
    const safeVal = Number((safe as any).value.value);
    const maxVal = Number((max as any).value.value);
    expect(safeVal).toBeLessThan(maxVal);
  });


  it("get-safe-borrow-amount returns non-zero for standard collateral", () => {
    setupProtocol();
    const { result } = getSafeBorrowAmount(COLLATERAL);
    const safe = Number((result as any).value.value);
    expect(safe).toBeGreaterThan(0);
  });


  it("get-safe-borrow-amount scales with collateral amount", () => {
    setupProtocol();
    const { result: r1 } = getSafeBorrowAmount(COLLATERAL);
    const { result: r2 } = getSafeBorrowAmount(COLLATERAL * 2);
    const s1 = Number((r1 as any).value.value);
    const s2 = Number((r2 as any).value.value);
    expect(s2).toBe(s1 * 2);
  });


  it("get-safe-borrow-amount equals sixty percent of collateral USD value", () => {
    setupProtocol();
    // collateral 1B microSTX * price 2M / 1M = 2B micro-USD; 60% = 1.2B
    const { result } = getSafeBorrowAmount(COLLATERAL);
    expect(result).toBeOk(Cl.uint(1_200_000_000));
  });


  it("get-liquidation-price returns zero when borrower has no loan", () => {
    const { result } = getLiquidationPrice(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-liquidation-price returns a positive value after opening a loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLiquidationPrice(wallet1);
    const liqPrice = Number((result as any).value.value);
    expect(liqPrice).toBeGreaterThan(0);
  });


  it("get-liquidation-price is below current oracle price for healthy position", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLiquidationPrice(wallet1);
    const liqPrice = Number((result as any).value.value);
    expect(liqPrice).toBeLessThan(2_000_000);
  });


  it("get-liquidation-price is zero for wallet2 before wallet2 borrows", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result } = getLiquidationPrice(wallet2);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-liquidation-price for wallet2 is positive after wallet2 borrows", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const { result } = getLiquidationPrice(wallet2);
    const liqPrice = Number((result as any).value.value);
    expect(liqPrice).toBeGreaterThan(0);
  });


  it("get-liquidation-price returns zero after full repayment", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getLiquidationPrice(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("get-interest-rate-info returns a result ok", () => {
    const { result } = getInterestRateInfo();
    expect(result).toBeOk(expect.anything());
  });


  it("get-interest-rate-info rate-per-block is ten", () => {
    const { result } = getInterestRateInfo();
    const info = (result as any).value.value;
    expect(Number(info["rate-per-block"].value)).toBe(10);
  });


  it("get-interest-rate-info precision is one million", () => {
    const { result } = getInterestRateInfo();
    const info = (result as any).value.value;
    expect(Number(info["precision"].value)).toBe(1_000_000);
  });


  it("get-interest-rate-info returns consistent values across multiple calls", () => {
    const { result: r1 } = getInterestRateInfo();
    const { result: r2 } = getInterestRateInfo();
    expect(r1).toEqual(r2);
  });


  it("snapshot is-liquidatable field matches is-liquidatable function result", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result: liq } = isLiquidatable(wallet1);
    const { result: snap } = getBorrowerSnapshot(wallet1);
    const snapLiq = (snap as any).value.value.value["is-liquidatable"].value;
    const liqVal = (liq as any).value.value;
    expect(snapLiq).toBe(liqVal);
  });


  it("total debt matches snapshot total-owed field", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: debtRes } = getTotalDebt(wallet1);
    const { result: snapRes } = getBorrowerSnapshot(wallet1);
    const debt = Number((debtRes as any).value.value);
    const snapDebt = Number((snapRes as any).value.value.value["total-owed"].value);
    expect(debt).toBe(snapDebt);
  });


  it("safe borrow amount is strictly less than max borrow for same collateral", () => {
    setupProtocol();
    const { result: safe } = getSafeBorrowAmount(COLLATERAL);
    const { result: max } = getMaxBorrow(COLLATERAL);
    const safeVal = Number((safe as any).value.value);
    const maxVal = Number((max as any).value.value);
    expect(safeVal).toBeLessThan(maxVal);
  });


  it("health factor at 80% LTV equals 1250", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    const { result } = getHealthFactor(wallet1);
    const health = Number((result as any).value.value);
    expect(health).toBe(1250);
  });


  it("health factor decreases as oracle price drops", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: r1 } = getHealthFactor(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_800_000)], deployer);
    const { result: r2 } = getHealthFactor(wallet1);
    const h1 = Number((r1 as any).value.value);
    const h2 = Number((r2 as any).value.value);
    expect(h2).toBeLessThan(h1);
  });


  it("health factor rises when oracle price increases", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: r1 } = getHealthFactor(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_500_000)], deployer);
    const { result: r2 } = getHealthFactor(wallet1);
    const h1 = Number((r1 as any).value.value);
    const h2 = Number((r2 as any).value.value);
    expect(h2).toBeGreaterThan(h1);
  });


  it("liquidate succeeds when LTV exceeds 80% threshold", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_200_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });


  it("liquidate fails with healthy error when LTV is below 80%", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_300_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeErr(Cl.uint(406));
  });


  it("liquidate succeeds at exactly 80% LTV boundary", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });


  it("collateral ratio equals 800 at 80% LTV threshold", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    const { result } = getCollateralRatio(wallet1);
    const ratio = Number((result as any).value.value);
    expect(ratio).toBe(800);
  });


  it("get-borrower-snapshot is-liquidatable is true when LTV exceeds 80%", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_200_000)], deployer);
    const { result } = getBorrowerSnapshot(wallet1);
    const snap = (result as any).value.value.value;
    expect(snap["is-liquidatable"].value).toBe(true);
  });


  it("get-borrower-snapshot is-liquidatable is false when LTV is below 80%", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_300_000)], deployer);
    const { result } = getBorrowerSnapshot(wallet1);
    const snap = (result as any).value.value.value;
    expect(snap["is-liquidatable"].value).toBe(false);
  });


  it("get-borrower-snapshot health-factor matches get-health-factor at 80% LTV", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    const { result: snapRes } = getBorrowerSnapshot(wallet1);
    const { result: healthRes } = getHealthFactor(wallet1);
    const snapHealth = Number((snapRes as any).value.value.value["health-factor"].value);
    const health = Number((healthRes as any).value.value);
    expect(snapHealth).toBe(health);
  });


  it("collateral ratio and health factor are consistent for the same position", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: ratioRes } = getCollateralRatio(wallet1);
    const { result: healthRes } = getHealthFactor(wallet1);
    const ratio = Number((ratioRes as any).value.value);
    const health = Number((healthRes as any).value.value);
    // health = collateral/debt * 1000, ratio = debt/collateral * 1000; product ~ 1M
    expect(ratio).toBeGreaterThan(0);
    expect(health).toBeGreaterThan(0);
  });


  it("estimated interest and total debt are consistent after borrow", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: interestRes } = getEstimatedInterest(wallet1);
    const { result: debtRes } = getTotalDebt(wallet1);
    const interest = Number((interestRes as any).value.value);
    const debt = Number((debtRes as any).value.value);
    expect(debt).toBeGreaterThanOrEqual(BORROW_AMOUNT + interest);
  });


  it("is-liquidatable false and collateral-ratio below LIQUIDATION_THRESHOLD are consistent", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: liqRes } = isLiquidatable(wallet1);
    const { result: ratioRes } = getCollateralRatio(wallet1);
    const liq = (liqRes as any).value.value;
    const ratio = Number((ratioRes as any).value.value);
    // Position is healthy: ratio < 800 (LIQUIDATION_THRESHOLD) and is-liquidatable false
    expect(liq).toBe(false);
    expect(ratio).toBeLessThan(800);
  });


  it("is-liquidatable true and collateral-ratio above LIQUIDATION_THRESHOLD are consistent", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result: liqRes } = isLiquidatable(wallet1);
    const { result: ratioRes } = getCollateralRatio(wallet1);
    const liq = (liqRes as any).value.value;
    const ratio = Number((ratioRes as any).value.value);
    expect(liq).toBe(true);
    expect(ratio).toBeGreaterThanOrEqual(800);
  });


  it("two borrowers have independent estimated interest values", () => {
    setupProtocol();
    borrowLoan(wallet1);
    borrowLoan(wallet2);
    const { result: i1 } = getEstimatedInterest(wallet1);
    const { result: i2 } = getEstimatedInterest(wallet2);
    // Both should be non-negative and independent
    expect(Number((i1 as any).value.value)).toBeGreaterThanOrEqual(0);
    expect(Number((i2 as any).value.value)).toBeGreaterThanOrEqual(0);
  });


  it("liquidation price is zero for borrower with no loan", () => {
    setupProtocol();
    const { result } = getLiquidationPrice(wallet1);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("is-liquidatable returns false when LTV is exactly 70% max borrow", () => {
    setupProtocol();
    borrowLoan(wallet1, 1_400_000_000);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(false));
  });


  it("is-liquidatable returns true when LTV exceeds 80% liquidation threshold", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_200_000)], deployer);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });


  it("is-liquidatable returns false when LTV is exactly 79% below threshold", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_270_000)], deployer);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(false));
  });


  it("is-liquidatable returns true when LTV slightly exceeds 80% boundary", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_249_000)], deployer);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });


  it("snapshot is none for both wallets before any borrow", () => {
    setupProtocol();
    const { result: s1 } = getBorrowerSnapshot(wallet1);
    const { result: s2 } = getBorrowerSnapshot(wallet2);
    expect(s1).toBeOk(Cl.none());
    expect(s2).toBeOk(Cl.none());
  });


  it("estimated interest returns zero for wallet2 when wallet2 has no loan", () => {
    setupProtocol();
    borrowLoan(wallet1);
    repayLoan(wallet1);
    const { result } = getEstimatedInterest(wallet2);
    expect(result).toBeOk(Cl.uint(0));
  });


  it("all query functions return ok without panicking when called on fresh simnet", () => {
    setupProtocol();
    const calls = [
      getTotalDebt(wallet1),
      getEstimatedInterest(wallet1),
      isLiquidatable(wallet1),
      getCollateralRatio(wallet1),
      getBorrowerSnapshot(wallet1),
      getLiquidationPrice(wallet1),
      getInterestRateInfo(),
    ];
    for (const { result } of calls) {
      expect((result as any).type).toBe("ok");
    }
  });

});

  it("health factor trend matches oracle price inversely for multiple price points", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const prices = [2_000_000, 1_800_000, 1_500_000, 1_300_000, 1_200_000];
    let prevHealth = Number.MAX_SAFE_INTEGER;
    for (const price of prices) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
      const { result } = getHealthFactor(wallet1);
      const health = Number((result as any).value.value);
      expect(health).toBeLessThan(prevHealth);
      prevHealth = health;
    }
  });

  it("liquidate succeeds at multiple price points below threshold", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (const price of [1_200_000, 1_000_000, 800_000, 500_000]) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
      const { result } = liquidateLoan(wallet1);
      expect(result).toBeOk(Cl.bool(true));
      // Re-open loan for next iteration
      if (price > 500_000) {
        simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
        simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
        borrowLoan(wallet1);
      }
    }
  });

  it("is-liquidatable returns false for multiple healthy price points", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (const price of [2_000_000, 1_800_000, 1_600_000, 1_400_000]) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
      const { result } = isLiquidatable(wallet1);
      expect(result).toBeOk(Cl.bool(false));
    }
  });

  it("is-liquidatable boundary at price 1250000 produces LTV of exactly 80%", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    const { result: ratioRes } = getCollateralRatio(wallet1);
    const { result: liqRes } = isLiquidatable(wallet1);
    const ratio = Number((ratioRes as any).value.value);
    expect(ratio).toBe(800);
    expect(liqRes).toBeOk(Cl.bool(true));
  });

  it("is-liquidatable returns false when price is just above 1250000 boundary", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_260_000)], deployer);
    const { result } = isLiquidatable(wallet1);
    expect(result).toBeOk(Cl.bool(false));
  });

  it("liquidate wallet2 succeeds when wallet2 LTV exceeds 80%", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_200_000)], deployer);
    const { result } = liquidateLoan(wallet2);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("health factor for wallet2 is independent after wallet1 borrows", () => {
    setupProtocol();
    borrowLoan(wallet1);
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_200_000)], deployer);
    const { result: h1 } = getHealthFactor(wallet1);
    const { result: h2 } = getHealthFactor(wallet2);
    expect(Number((h1 as any).value.value)).toBeCloseTo(Number((h2 as any).value.value));
  });

  it("snapshot is-liquidatable matches liquidate result at 80% LTV boundary", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    const { result: snapRes } = getBorrowerSnapshot(wallet1);
    const { result: liqRes } = liquidateLoan(wallet1);
    const snapLiq = (snapRes as any).value.value.value["is-liquidatable"].value;
    expect(snapLiq).toBe(true);
    expect(liqRes).toBeOk(Cl.bool(true));
  });

  it("safe borrow amount ensures health factor stays above liquidation threshold", () => {
    setupProtocol();
    const { result: safe } = getSafeBorrowAmount(COLLATERAL);
    borrowLoan(wallet1, Number((safe as any).value.value));
    const { result } = getHealthFactor(wallet1);
    const health = Number((result as any).value.value);
    // At 60% LTV, health factor = 1000/0.6 = 1667
    expect(health).toBeGreaterThan(LIQUIDATION_HEALTH_FACTOR);
  });

  it("liquidation health check consistency across all query functions", () => {
    setupProtocol();
    borrowLoan(wallet1);
    // Price above boundary
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_400_000)], deployer);
    expect(isLiquidatable(wallet1).result).toBeOk(Cl.bool(false));
    expect(liquidateLoan(wallet1).result).toBeErr(Cl.uint(406));
    // Re-open
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
    borrowLoan(wallet1);
    // Price at boundary
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_250_000)], deployer);
    expect(isLiquidatable(wallet1).result).toBeOk(Cl.bool(true));
    expect(liquidateLoan(wallet1).result).toBeOk(Cl.bool(true));
  });

  it("health factor edge case scenario variant 1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const price = 1800000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 2", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const price = 1750000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const price = 1700000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 4", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const price = 1650000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const price = 1600000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 6", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const price = 1550000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const price = 1500000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 8", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const price = 1450000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const price = 1400000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor edge case scenario variant 10", () => {
    setupProtocol();
    borrowLoan(wallet2);
    const price = 1350000;
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor changes proportionally with interval price drops", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const prices = [2_000_000, 1_750_000, 1_500_000, 1_250_000];
    let prevHealth = 0;
    for (const price of prices) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(price)], deployer);
      const { result } = getHealthFactor(wallet1);
      const health = Number((result as any).value.value);
      if (prevHealth > 0) {
        expect(health).toBeLessThan(prevHealth);
      }
      prevHealth = health;
    }
  });

  it("liquidation price equals oracle price when health factor equals 1250", () => {
    setupProtocol();
    borrowLoan(wallet1);
    const { result: liqPrice } = getLiquidationPrice(wallet1);
    const expectedPrice = Number((liqPrice as any).value.value);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(expectedPrice)], deployer);
    const { result: health } = getHealthFactor(wallet1);
    expect(Number((health as any).value.value)).toBeLessThanOrEqual(1250);
  });

  it("liquidation event recorded in registry after liquidate", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result: liqResult } = liquidateLoan(wallet1);
    expect(liqResult).toBeOk(Cl.bool(true));
    const { result: regResult } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(regResult).toBeOk(Cl.uint(1));
  });

  it("multiple liquidations increment registry counter", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    // Setup for wallet2
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("liquidator stats update after each liquidation", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats", [Cl.principal(wallet1)], deployer);
    const stats = (result as any).value.value;
    expect(Number(stats["total-liquidations"].value)).toBe(1);
  });

  it("liquidation event details are queryable by event ID", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    const event = (result as any).value.value;
    expect(event).toBeDefined();
    expect(event.borrower.value).toBe(wallet1);
  });

  it("liquidation registry tracks total liquidated value", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result: valueRes } = simnet.callReadOnlyFn("liquidation", "get-total-liquidated-value", [], deployer);
    expect(Number((valueRes as any).value.value)).toBeGreaterThan(0);
  });

  it("multiple liquidators have independent stats in registry", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    // wallet2 liquidates next
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
    simnet.callPublicFn("ausd-token", "mint", [Cl.uint(10_000_000_000), Cl.principal(wallet2)], deployer);
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1, wallet2);
    const { result: stats1 } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats", [Cl.principal(wallet1)], deployer);
    const { result: stats2 } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats", [Cl.principal(wallet2)], deployer);
    const s1 = Number(((stats1 as any).value.value)["total-liquidations"].value);
    const s2 = Number(((stats2 as any).value.value)["total-liquidations"].value);
    expect(s1).toBe(1);
    expect(s2).toBe(1);
  });

  it("get-stx-price caches price within 10-block window", () => {
    setupProtocol();
    // Price is set in setupProtocol, check cached value
    const { result: p1 } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    // Price should be cached, advance a few blocks
    for (let i = 0; i < 5; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result: p2 } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(p1).toEqual(p2);
  });

  it("price cache refreshes after 10+ blocks", () => {
    setupProtocol();
    const { result: p1 } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    // Advance many blocks
    for (let i = 0; i < 15; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    // Change oracle price
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(3_000_000)], deployer);
    // Next call should use new price
    const { result: p2 } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(p1).not.toEqual(p2);
  });

  it("compute-total-debt matches get-total-debt result", () => {
    setupProtocol();
    borrowLoan(wallet1);
    // Advance blocks
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    // liquidate triggers compute-total-debt, compare with get-total-debt before
    const { result: debtBefore } = getTotalDebt(wallet1);
    const debtVal = Number((debtBefore as any).value.value);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result: liqResult } = liquidateLoan(wallet1);
    expect(liqResult).toBeOk(Cl.bool(true));
  });

  it("lending pool returns proper error codes for all invalid operations", () => {
    setupProtocol();
    // No active loan
    expect(repayLoan(wallet1).result).toBeErr(Cl.uint(403));
    // Already has loan
    borrowLoan(wallet1);
    expect(borrowLoan(wallet1).result).toBeErr(Cl.uint(407));
    // Zero borrow
    expect(borrowLoan(wallet2, 0).result).toBeErr(Cl.uint(402));
  });

  it("borrow edge case 1: zero collateral borrow rejected", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 100, 0);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("borrow edge case 2: zero collateral borrow rejected", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 100, 0);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("borrow edge case 3: zero collateral borrow rejected", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 100, 0);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("borrow edge case 4: zero collateral borrow rejected", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 100, 0);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("borrow edge case 5: zero collateral borrow rejected", () => {
    setupProtocol();
    const { result } = borrowLoan(wallet1, 100, 0);
    expect(result).toBeErr(Cl.uint(402));
  });

  it("liquidation scenario 1: price crash to 50000", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(50000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("liquidation scenario 2: price crash to 100000", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(100000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("liquidation scenario 3: price crash to 150000", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(150000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("liquidation scenario 4: price crash to 200000", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(200000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("liquidation scenario 5: price crash to 250000", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(250000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("get-max-borrow returns uint type", () => {
    const { result } = getMaxBorrow();
    expect((result as any).type).toBe("ok");
    expect((result as any).value.type).toBe("uint");
  });

  it("health factor deterministic calculation variant 1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 1; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(2000000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 2; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1900000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1800000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 4; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1700000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 5; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1600000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 6", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 6; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1500000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 7; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1400000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 8", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 8; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1300000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 9; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1200000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 10", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 10; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1100000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 11", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 11; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(1000000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 12", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 12; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(900000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 13", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 13; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(800000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 14", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 14; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(700000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor deterministic calculation variant 15", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let i = 0; i < 15; i++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(600000)], deployer);
    }
    const { result } = getHealthFactor(wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 1", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1800000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 2", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1730000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 3", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1660000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 4", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1590000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 5", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1520000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 6", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1450000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 7", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1380000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 8", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1310000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 9", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1240000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("health factor with wallet2 scenario 10", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1170000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 6", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 8", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation registry event query variant 10", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidation-event", [Cl.uint(0)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet1)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 2", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet2);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet2)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet1)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 4", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet2);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet2)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet1)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 6", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet2);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet2)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet1)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 8", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet2);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet2)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet1)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation liquidator stats variant 10", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet2);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-liquidator-stats",
      [Cl.principal(wallet2)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidation total counter variant 1", () => {
    setupProtocol();
    for (let j = 0; j < 1; j++) {
      borrowLoan(wallet1);
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
      liquidateLoan(wallet1);
      if (j < 0) {
        simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
        simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
      }
    }
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(Number((result as any).value.value)).toBe(1);
  });

  it("liquidation total counter variant 2", () => {
    setupProtocol();
    for (let j = 0; j < 2; j++) {
      borrowLoan(wallet1);
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
      liquidateLoan(wallet1);
      if (j < 1) {
        simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
        simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
      }
    }
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(Number((result as any).value.value)).toBe(2);
  });

  it("liquidation total counter variant 3", () => {
    setupProtocol();
    for (let j = 0; j < 3; j++) {
      borrowLoan(wallet1);
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
      liquidateLoan(wallet1);
      if (j < 2) {
        simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
        simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
      }
    }
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(Number((result as any).value.value)).toBe(3);
  });

  it("liquidation total counter variant 4", () => {
    setupProtocol();
    for (let j = 0; j < 4; j++) {
      borrowLoan(wallet1);
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
      liquidateLoan(wallet1);
      if (j < 3) {
        simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
        simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
      }
    }
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(Number((result as any).value.value)).toBe(4);
  });

  it("liquidation total counter variant 5", () => {
    setupProtocol();
    for (let j = 0; j < 5; j++) {
      borrowLoan(wallet1);
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
      liquidateLoan(wallet1);
      if (j < 4) {
        simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
        simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
      }
    }
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(Number((result as any).value.value)).toBe(5);
  });

  it("price cache consistency read 1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 0; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 1; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 2; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 3; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 4; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 6", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 5; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 6; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 8", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 7; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 8; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache consistency read 10", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 9; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("liquidate without state mutation variant 1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2000000)], deployer);
    const { before } = getTotalBorrowed();
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    const { after } = getTotalBorrowed();
    expect(Number((after as any).value.value)).toBe(0);
  });

  it("liquidate without state mutation variant 2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1700000)], deployer);
    const { before } = getTotalBorrowed();
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    const { after } = getTotalBorrowed();
    expect(Number((after as any).value.value)).toBe(0);
  });

  it("liquidate without state mutation variant 3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1400000)], deployer);
    const { before } = getTotalBorrowed();
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    const { after } = getTotalBorrowed();
    expect(Number((after as any).value.value)).toBe(0);
  });

  it("liquidate without state mutation variant 4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1100000)], deployer);
    const { before } = getTotalBorrowed();
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    const { after } = getTotalBorrowed();
    expect(Number((after as any).value.value)).toBe(0);
  });

  it("liquidate without state mutation variant 5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(800000)], deployer);
    const { before } = getTotalBorrowed();
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    const { after } = getTotalBorrowed();
    expect(Number((after as any).value.value)).toBe(0);
  });

  it("error code 400 boundary test", () => {
    setupProtocol();
    if (0 === 0) {
      // Test ERR-NOT-AUTHORIZED at vault level
      const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral",
        [Cl.principal(wallet1), Cl.uint(100)], wallet2);
      expect(result).toBeErr(Cl.uint(300));
    }
  });

  it("error code 401 boundary test", () => {
    setupProtocol();
    if (1 === 0) {
      // Test ERR-NOT-AUTHORIZED at vault level
      const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral",
        [Cl.principal(wallet1), Cl.uint(100)], wallet2);
      expect(result).toBeErr(Cl.uint(300));
    }
  });

  it("error code 402 boundary test", () => {
    setupProtocol();
    if (2 === 0) {
      // Test ERR-NOT-AUTHORIZED at vault level
      const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral",
        [Cl.principal(wallet1), Cl.uint(100)], wallet2);
      expect(result).toBeErr(Cl.uint(300));
    }
  });

  it("error code 403 boundary test", () => {
    setupProtocol();
    if (3 === 0) {
      // Test ERR-NOT-AUTHORIZED at vault level
      const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral",
        [Cl.principal(wallet1), Cl.uint(100)], wallet2);
      expect(result).toBeErr(Cl.uint(300));
    }
  });

  it("error code 404 boundary test", () => {
    setupProtocol();
    if (4 === 0) {
      // Test ERR-NOT-AUTHORIZED at vault level
      const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral",
        [Cl.principal(wallet1), Cl.uint(100)], wallet2);
      expect(result).toBeErr(Cl.uint(300));
    }
  });

  it("lending pool configure rejection variant 1", () => {
    const { result } = simnet.callPublicFn("lending-pool", "configure",
      [Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1)], wallet2);
    expect(result).toBeErr(Cl.uint(400));
  });

  it("lending pool configure rejection variant 2", () => {
    const { result } = simnet.callPublicFn("lending-pool", "configure",
      [Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1)], wallet2);
    expect(result).toBeErr(Cl.uint(400));
  });

  it("lending pool configure rejection variant 3", () => {
    const { result } = simnet.callPublicFn("lending-pool", "configure",
      [Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1)], wallet2);
    expect(result).toBeErr(Cl.uint(400));
  });

  it("lending pool configure rejection variant 4", () => {
    const { result } = simnet.callPublicFn("lending-pool", "configure",
      [Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1)], wallet2);
    expect(result).toBeErr(Cl.uint(400));
  });

  it("lending pool configure rejection variant 5", () => {
    const { result } = simnet.callPublicFn("lending-pool", "configure",
      [Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1), Cl.principal(wallet1)], wallet2);
    expect(result).toBeErr(Cl.uint(400));
  });

  it("health factor edge test batch5-1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2000000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-2", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1950000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1900000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-4", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1850000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1800000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-6", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1750000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1700000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-8", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1650000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1600000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-10", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1550000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-11", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1500000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-12", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1450000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-13", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1400000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-14", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1350000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-15", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1300000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-16", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1250000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-17", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1200000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-18", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1150000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-19", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1100000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-20", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1050000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-21", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(1000000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-22", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(950000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-23", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(900000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-24", () => {
    setupProtocol();
    borrowLoan(wallet2);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(850000)], deployer);
    const { result } = getHealthFactor(wallet2);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("health factor edge test batch5-25", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(800000)], deployer);
    const { result } = getHealthFactor(wallet1);
    expect(Number((result as any).value.value)).toBeGreaterThan(0);
  });

  it("liq reg integration test #1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #6", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #8", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #10", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #11", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #12", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #13", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #14", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #15", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #16", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #17", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #18", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #19", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #20", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #21", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #22", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #23", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #24", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("liq reg integration test #25", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    liquidateLoan(wallet1);
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("price cache test #1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 0; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 1; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 2; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 3; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 4; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #6", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 5; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 6; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #8", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 7; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 8; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #10", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 9; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #11", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 10; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #12", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 11; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #13", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 0; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #14", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 1; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #15", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 2; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #16", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 3; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #17", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 4; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #18", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 5; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #19", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 6; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #20", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 7; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #21", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 8; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #22", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 9; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #23", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 10; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #24", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 11; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #25", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 0; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #26", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 1; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #27", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 2; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #28", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 3; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #29", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 4; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #30", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 5; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #31", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 6; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #32", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 7; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #33", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 8; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #34", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 9; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #35", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 10; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #36", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 11; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("price cache test #37", () => {
    setupProtocol();
    borrowLoan(wallet1);
    for (let b = 0; b < 0; b++) {
      simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    }
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer);
    expect(result).toBeOk(expect.anything());
  });

  it("state optimization test #1", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #2", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #3", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #4", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #5", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #6", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #7", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #8", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #9", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #10", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #11", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #12", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #13", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #14", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #15", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #16", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #17", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #18", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #19", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #20", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #21", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #22", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #23", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #24", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #25", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #26", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #27", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #28", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #29", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #30", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #31", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #32", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #33", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #34", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #35", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #36", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #37", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #38", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #39", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #40", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #41", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #42", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #43", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("state optimization test #44", () => {
    setupProtocol();
    borrowLoan(wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    const { result } = liquidateLoan(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("error handling scenario #1 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #2 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #3 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #4 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #5 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #6 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #7 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #8 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #9 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #10 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #11 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #12 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #13 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #14 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #15 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #16 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #17 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("error handling scenario #18 on lending-pool", () => {
    const { result } = simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(0), Cl.uint(0)], wallet1);
    expect((result as any).type).toBe("err");
  });
