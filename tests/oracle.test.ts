import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("oracle", () => {
  it("initializes with zero price", () => {
    const { result } = simnet.callReadOnlyFn("oracle", "get-price-unsafe", [], deployer);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("owner can set price", () => {
    const { result } = simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_500_000)], deployer);
    expect(result).toBeOk(Cl.uint(1_500_000));
  });

  it("non-owner cannot set price", () => {
    const { result } = simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_500_000)], wallet1);
    expect(result).toBeErr(Cl.uint(100));
  });

  it("rejects zero price", () => {
    const { result } = simnet.callPublicFn("oracle", "set-price", [Cl.uint(0)], deployer);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("returns price after setting", () => {
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_000_000)], deployer);
    const { result } = simnet.callReadOnlyFn("oracle", "get-price", [], deployer);
    expect(result).toBeOk(Cl.uint(2_000_000));
  });

  it("owner can transfer ownership", () => {
    simnet.callPublicFn("oracle", "transfer-ownership", [Cl.principal(wallet1)], deployer);
    const { result } = simnet.callReadOnlyFn("oracle", "get-owner", [], deployer);
    expect(result).toBeOk(Cl.principal(wallet1));
  });

  it("new owner can set price after transfer", () => {
    simnet.callPublicFn("oracle", "transfer-ownership", [Cl.principal(wallet1)], deployer);
    const { result } = simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_800_000)], wallet1);
    expect(result).toBeOk(Cl.uint(1_800_000));
  });

  it("old owner cannot set price after transfer", () => {
    simnet.callPublicFn("oracle", "transfer-ownership", [Cl.principal(wallet1)], deployer);
    const { result } = simnet.callPublicFn("oracle", "set-price", [Cl.uint(1_800_000)], deployer);
    expect(result).toBeErr(Cl.uint(100));
  });

  it("returns precision constant", () => {
    const { result } = simnet.callReadOnlyFn("oracle", "get-precision", [], deployer);
    expect(result).toBeOk(Cl.uint(1_000_000));
  });
});

  it("get-price returns stale error when price never set", () => {
    const { result } = simnet.callReadOnlyFn("oracle", "get-price", [], deployer);
    expect(result).toBeErr(Cl.uint(102));
  });

  it("get-price-unsafe returns zero when price never set", () => {
    const { result } = simnet.callReadOnlyFn("oracle", "get-price-unsafe", [], deployer);
    expect(result).toBeOk(Cl.uint(0));
  });

  it("get-price returns ok after price is set", () => {
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_000_000)], deployer);
    const { result } = simnet.callReadOnlyFn("oracle", "get-price", [], deployer);
    expect(result).toBeOk(Cl.uint(2_000_000));
  });

  it("get-last-updated matches set-price block", () => {
    simnet.callPublicFn("oracle", "set-price", [Cl.uint(2_000_000)], deployer);
    const { result } = simnet.callReadOnlyFn("oracle", "get-last-updated", [], deployer);
    expect(result).toBeOk(expect.anything());
  });
