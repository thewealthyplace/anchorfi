import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("liquidation", () => {
  it("total liquidations starts at zero", () => {
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidations", [], deployer);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("total liquidated value starts at zero", () => {
    const { result } = simnet.callReadOnlyFn("liquidation", "get-total-liquidated-value", [], deployer);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("new liquidator has zero stats", () => {
    const { result } = simnet.callReadOnlyFn(
      "liquidation", "get-liquidator-stats", [Cl.principal(wallet1)], deployer
    );
    expect(result).toBeOk(Cl.tuple({ "total-liquidations": Cl.uint(0), "total-profit": Cl.uint(0) }));
  });

  it("only lending pool can record liquidation", () => {
    const { result } = simnet.callPublicFn(
      "liquidation", "record-liquidation",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.uint(1_000_000), Cl.uint(1_100_000)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(500));
  });

  it("owner can set lending pool address", () => {
    const { result } = simnet.callPublicFn(
      "liquidation", "set-lending-pool", [Cl.principal(wallet1)], deployer
    );
    expect(result).toBeOk(Cl.principal(wallet1));
  });

  it("non-owner cannot set lending pool", () => {
    const { result } = simnet.callPublicFn(
      "liquidation", "set-lending-pool", [Cl.principal(wallet2)], wallet1
    );
    expect(result).toBeErr(Cl.uint(500));
  });

  it("liquidation event can be queried by id", () => {
    const { result } = simnet.callReadOnlyFn(
      "liquidation", "get-liquidation-event", [Cl.uint(0)], deployer
    );
    expect(result).toBeOk(Cl.none());
  });
});
