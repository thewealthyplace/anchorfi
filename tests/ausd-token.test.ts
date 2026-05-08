import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("ausd-token", () => {
  it("has correct name", () => {
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-name", [], deployer);
    expect(result).toBeOk(Cl.stringAscii("AnchorFi USD"));
  });

  it("has correct symbol", () => {
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-symbol", [], deployer);
    expect(result).toBeOk(Cl.stringAscii("aUSD"));
  });

  it("has 6 decimals", () => {
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-decimals", [], deployer);
    expect(result).toBeOk(Cl.uint(6));
  });

  it("total supply starts at zero", () => {
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-total-supply", [], deployer);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("minter can mint tokens", () => {
    const { result } = simnet.callPublicFn(
      "ausd-token", "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("mint increases balance", () => {
    simnet.callPublicFn("ausd-token", "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], deployer);
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-balance", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(1_000_000));
  });

  it("non-minter cannot mint", () => {
    const { result } = simnet.callPublicFn(
      "ausd-token", "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], wallet1
    );
    expect(result).toBeErr(Cl.uint(200));
  });

  it("minter can burn tokens", () => {
    simnet.callPublicFn("ausd-token", "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], deployer);
    const { result } = simnet.callPublicFn(
      "ausd-token", "burn", [Cl.uint(500_000), Cl.principal(wallet1)], deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("token holder can transfer", () => {
    simnet.callPublicFn("ausd-token", "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], deployer);
    const { result } = simnet.callPublicFn(
      "ausd-token", "transfer",
      [Cl.uint(500_000), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("non-owner cannot transfer another's tokens", () => {
    simnet.callPublicFn("ausd-token", "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], deployer);
    const { result } = simnet.callPublicFn(
      "ausd-token", "transfer",
      [Cl.uint(500_000), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet2
    );
    expect(result).toBeErr(Cl.uint(201));
  });

  it("owner can update minter", () => {
    simnet.callPublicFn("ausd-token", "set-minter", [Cl.principal(wallet1)], deployer);
    const { result } = simnet.callReadOnlyFn("ausd-token", "get-minter", [], deployer);
    expect(result).toBeOk(Cl.principal(wallet1));
  });
});
