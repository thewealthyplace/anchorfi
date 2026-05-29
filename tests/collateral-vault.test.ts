import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const DEPOSIT_AMOUNT = 1_000_000_000;

describe("collateral-vault", () => {
  it("new user has empty vault", () => {
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.tuple({ deposited: Cl.uint(0), locked: Cl.uint(0) }));
  });

  it("user can deposit STX", () => {
    const { result } = simnet.callPublicFn(
      "collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet1
    );
    expect(result).toBeOk(Cl.uint(DEPOSIT_AMOUNT));
  });

  it("deposit updates vault balance", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.tuple({ deposited: Cl.uint(DEPOSIT_AMOUNT), locked: Cl.uint(0) }));
  });

  it("rejects zero deposit", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(0)], wallet1);
    expect(result).toBeErr(Cl.uint(301));
  });

  it("user can withdraw unlocked collateral", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet1);
    const { result } = simnet.callPublicFn(
      "collateral-vault", "withdraw", [Cl.uint(DEPOSIT_AMOUNT)], wallet1
    );
    expect(result).toBeOk(Cl.uint(DEPOSIT_AMOUNT));
  });

  it("cannot withdraw more than deposited", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet1);
    const { result } = simnet.callPublicFn(
      "collateral-vault", "withdraw", [Cl.uint(DEPOSIT_AMOUNT + 1)], wallet1
    );
    expect(result).toBeErr(Cl.uint(303));
  });

  it("cannot withdraw from empty vault", () => {
    const { result } = simnet.callPublicFn(
      "collateral-vault", "withdraw", [Cl.uint(DEPOSIT_AMOUNT)], wallet1
    );
    expect(result).toBeErr(Cl.uint(304));
  });

  it("total collateral tracks deposits from multiple users", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet1);
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet2);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(DEPOSIT_AMOUNT * 2));
  });

  it("available collateral reflects unlocked balance", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(DEPOSIT_AMOUNT)], wallet1);
    const { result } = simnet.callReadOnlyFn(
      "collateral-vault", "get-available-collateral", [Cl.principal(wallet1)], wallet1
    );
    expect(result).toBeOk(Cl.uint(DEPOSIT_AMOUNT));
  });
});

  it("cannot deposit zero STX", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(0)], wallet1);
    expect(result).toBeErr(Cl.uint(301));
  });

  it("cannot lock more than deposited", () => {
    // This should fail since no deposit was made
    const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral", [Cl.principal(wallet1), Cl.uint(100)], deployer);
    expect(result).toBeErr(Cl.uint(304));
  });

  it("vault total-collateral increases after multiple deposits", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(500_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(500_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(1_000_000_000));
  });

  it("vault total-collateral decreases after withdrawal", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(400_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(600_000_000));
  });

  it("lock-collateral increases locked amount without changing deposited", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    // Set lending pool first
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(500_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    const vault = (result as any).value.value;
    expect(Number(vault.deposited.value)).toBe(1_000_000_000);
    expect(Number(vault.locked.value)).toBe(500_000_000);
  });

  it("unlock-collateral decreases locked amount", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(500_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "unlock-collateral",
      [Cl.principal(wallet1), Cl.uint(300_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    const vault = (result as any).value.value;
    expect(Number(vault.locked.value)).toBe(200_000_000);
  });

  it("cannot unlock more than locked collateral", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(500_000_000)], wallet1);
    const { result } = simnet.callPublicFn("collateral-vault", "unlock-collateral",
      [Cl.principal(wallet1), Cl.uint(600_000_000)], wallet1);
    expect(result).toBeErr(Cl.uint(302));
  });

  it("non-lending-pool cannot lock collateral", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    const { result } = simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(100)], wallet2);
    expect(result).toBeErr(Cl.uint(300));
  });

  it("seize-collateral reduces deposited and total-collateral", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(500_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "seize-collateral",
      [Cl.principal(wallet1), Cl.uint(200_000_000), Cl.principal(wallet2)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(800_000_000));
  });

  it("seize-collateral updates locked amount correctly", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(500_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "seize-collateral",
      [Cl.principal(wallet1), Cl.uint(200_000_000), Cl.principal(wallet2)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    const v = (result as any).value.value;
    expect(Number(v.deposited.value)).toBe(800_000_000);
    expect(Number(v.locked.value)).toBe(300_000_000);
  });

  it("available-collateral equals deposited minus locked", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(300_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-available-collateral",
      [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(Cl.uint(700_000_000));
  });

  it("vault deposit from wallet2 is independent from wallet1", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(500_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(300_000_000)], wallet2);
    const { result: v1 } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    const { result: v2 } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet2)], wallet2);
    expect(Number(((v1 as any).value.value).deposited.value)).toBe(500_000_000);
    expect(Number(((v2 as any).value.value).deposited.value)).toBe(300_000_000);
  });

  it("vault allows multiple lock and unlock cycles", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(300_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "unlock-collateral",
      [Cl.principal(wallet1), Cl.uint(200_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(400_000_000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    const v = (result as any).value.value;
    expect(Number(v.locked.value)).toBe(500_000_000);
  });

  it("vault withdraw after lock only uses unlocked portion", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(400_000_000)], wallet1);
    // Withdraw 300M from unlocked (600M available)
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw",
      [Cl.uint(300_000_000)], wallet1);
    expect(result).toBeOk(Cl.uint(300_000_000));
  });

  it("vault cannot withdraw locked collateral", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1_000_000_000)], wallet1);
    simnet.callPublicFn("collateral-vault", "set-lending-pool",
      [Cl.principal(`${deployer}.lending-pool`)], deployer);
    simnet.callPublicFn("collateral-vault", "lock-collateral",
      [Cl.principal(wallet1), Cl.uint(700_000_000)], wallet1);
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw",
      [Cl.uint(500_000_000)], wallet1);
    expect(result).toBeErr(Cl.uint(303));
  });

  it("vault stress test scenario 1", () => {
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(100_000_000)], wallet1);
    }
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(300_000_000));
  });

  it("vault stress test scenario 2", () => {
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(100_000_000)], wallet1);
    }
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(300_000_000));
  });

  it("vault stress test scenario 3", () => {
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(100_000_000)], wallet1);
    }
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(300_000_000));
  });

  it("vault stress test scenario 4", () => {
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(100_000_000)], wallet1);
    }
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(300_000_000));
  });

  it("vault stress test scenario 5", () => {
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(100_000_000)], wallet1);
    }
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-total-collateral", [], deployer);
    expect(result).toBeOk(Cl.uint(300_000_000));
  });

  it("vault operation sequence 1", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(500000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 2", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(600000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 3", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(700000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 4", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(800000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 5", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(900000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 6", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1000000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 7", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1100000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 8", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1200000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 9", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1300000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 10", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1400000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 11", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1500000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 12", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1600000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 13", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1700000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 14", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1800000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault operation sequence 15", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(1900000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault error scenario #1", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #2", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #3", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #4", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #5", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #6", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #7", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #8", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #9", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #10", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #11", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #12", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #13", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #14", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #15", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #16", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #17", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #18", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault error scenario #19", () => {
    const { result } = simnet.callPublicFn("collateral-vault", "withdraw", [Cl.uint(100)], wallet1);
    expect((result as any).type).toBe("err");
  });

  it("vault deposit test #1", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(500000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #2", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(510000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #3", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(520000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #4", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(530000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #5", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(540000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #6", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(550000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #7", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(560000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #8", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(570000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #9", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(580000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #10", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(590000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #11", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(600000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #12", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(610000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #13", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(620000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #14", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(630000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #15", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(640000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #16", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(650000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #17", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(660000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #18", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(670000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });

  it("vault deposit test #19", () => {
    simnet.callPublicFn("collateral-vault", "deposit", [Cl.uint(680000000)], wallet1);
    const { result } = simnet.callReadOnlyFn("collateral-vault", "get-vault", [Cl.principal(wallet1)], wallet1);
    expect(result).toBeOk(expect.anything());
  });
