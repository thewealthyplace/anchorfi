import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const STX_PRICE = 2_000_000;
const COLLATERAL = 1_000_000_000;     // 1000 STX in microSTX
const BORROW_AMOUNT = 1_000_000_000;  // $1000 aUSD — within 70% LTV of $2000 collateral value

function setupProtocol() {
  // Authorize lending-pool as the vault's controller and aUSD minter
  simnet.callPublicFn("collateral-vault", "set-lending-pool",
    [Cl.principal(`${deployer}.lending-pool`)], deployer);
  simnet.callPublicFn("ausd-token", "set-minter",
    [Cl.principal(`${deployer}.lending-pool`)], deployer);
  simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
  simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(COLLATERAL)], wallet1);
}

describe("lending-pool", () => {
  it("total borrowed starts at zero", () => {
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-total-borrowed", [], deployer);
    expect(result).toBeOk(Cl.uint(0));
    it("records a single borrow event", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(1));
    it("records repay event after full loan repayment", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    simnet.callPublicFn("lending-pool", "repay", [Cl.uint(BORROW_AMOUNT)], wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(2));
    it("returns zero loan event count for borrower without loans", () => {
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(0));
    it("records partial repay event without closing loan", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    simnet.callPublicFn("lending-pool", "repay", [Cl.uint(100_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(2));
    it("records liquidation event when loan is liquidated", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(500_000)], deployer);
    simnet.callPublicFn("lending-pool", "liquidate", [Cl.principal(wallet1)], wallet2);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(wallet1)], wallet2);
    expect(result).toBeOk(Cl.uint(2));
    it("retrieves borrow event by index after borrow", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan-event", [Cl.principal(wallet1), Cl.uint(0)], wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
    it("returns the last loan event after repayment", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    simnet.callPublicFn("lending-pool", "repay", [Cl.uint(100_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-last-loan-event", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.some(expect.anything()));
  });

});

});

});

});

});

});

});

  it("returns max borrow for given collateral", () => {
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(STX_PRICE)], deployer);
    const { result } = simnet.callReadOnlyFn(
      "lending-pool", "get-max-borrow", [Cl.uint(COLLATERAL)], deployer
    );
    // 1000 STX * $2 = $2000 * 70% LTV = $1400
    expect(result).toBeOk(Cl.uint(1_400_000_000));
  });

  it("user can borrow against deposited collateral", () => {
    setupProtocol();
    const { result } = simnet.callPublicFn(
      "lending-pool", "borrow",
      [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)],
      wallet1
    );
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("borrow mints aUSD to borrower", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-balance", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("records borrow history event for the borrower", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const count = simnet.callReadOnlyFn("lending-pool", "get-loan-event-count", [Cl.principal(wallet1)], wallet1).result;
    expect(count).toBeOk(Cl.uint(1));
    const event = simnet.callReadOnlyFn("lending-pool", "get-last-loan-event", [Cl.principal(wallet1)], wallet1).result;
    expect(event).toBeOk(Cl.some(expect.anything()));
  });

  it("cannot borrow over LTV limit", () => {
    setupProtocol();
    const { result } = simnet.callPublicFn(
      "lending-pool", "borrow",
      [Cl.uint(1_500_000_000), Cl.uint(COLLATERAL)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(402));
  });

  it("cannot open two loans simultaneously", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const { result } = simnet.callPublicFn(
      "lending-pool", "borrow",
      [Cl.uint(100_000_000), Cl.uint(100_000_000)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(400));
  });

  it("user can repay loan", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const { result } = simnet.callPublicFn(
      "lending-pool", "repay", [Cl.uint(BORROW_AMOUNT)], wallet1
    );
    expect(result).toBeOk(Cl.uint(BORROW_AMOUNT));
  });

  it("full repayment clears the loan", () => {
    // Pre-mint interest buffer while deployer is still the minter (before setup hands it to lending-pool)
    simnet.callPublicFn("ausd-token", "mint", [Cl.uint(100_000), Cl.principal(wallet1)], deployer);
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    // 1 block elapses between borrow and repay: interest = 1_000_000_000 * 10 / 1_000_000 = 10_000
    simnet.callPublicFn("lending-pool", "repay", [Cl.uint(BORROW_AMOUNT + 10_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("lending-pool", "get-loan", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.none());
  });

  it("cannot repay without active loan", () => {
    const { result } = simnet.callPublicFn("lending-pool", "repay", [Cl.uint(1_000_000)], wallet1);
    expect(result).toBeErr(Cl.uint(403));
  });

  it("health factor is zero for user with no loan", () => {
    const { result } = simnet.callReadOnlyFn(
      "lending-pool", "get-health-factor", [Cl.principal(wallet1)], deployer
    );
    expect(result).toBeOk(Cl.uint(0));
  });

  it("cannot liquidate healthy position", () => {
    setupProtocol();
    simnet.callPublicFn("lending-pool", "borrow", [Cl.uint(BORROW_AMOUNT), Cl.uint(COLLATERAL)], wallet1);
    const { result } = simnet.callPublicFn(
      "lending-pool", "liquidate", [Cl.principal(wallet1)], wallet2
    );
    expect(result).toBeErr(Cl.uint(406));
  });
});
