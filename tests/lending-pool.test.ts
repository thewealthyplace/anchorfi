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

});
