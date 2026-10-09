import { describe, it, expect } from "vitest";
import { isTechOrConductor, isVisitorOnlyAccount } from "../access.js";
import type { Member } from "../../generated/prisma/index.js";

function makeMember(roles: string[]): Member {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { roles } as any;
}

describe("isVisitorOnlyAccount", () => {
  it("所属が0件の場合はfalse（システム管理者専用アカウント等）", () => {
    expect(isVisitorOnlyAccount([])).toBe(false);
  });

  it("単一の所属がvisitorのみの場合はtrue", () => {
    expect(isVisitorOnlyAccount([makeMember(["visitor"])])).toBe(true);
  });

  it("複数所属が全てvisitorの場合はtrue", () => {
    expect(isVisitorOnlyAccount([makeMember(["visitor"]), makeMember(["visitor"])])).toBe(true);
  });

  it("visitorとmember以上が混在する場合はfalse", () => {
    expect(isVisitorOnlyAccount([makeMember(["visitor"]), makeMember(["member"])])).toBe(false);
  });

  it("通常のmemberのみの場合はfalse", () => {
    expect(isVisitorOnlyAccount([makeMember(["member"])])).toBe(false);
  });

  it("adminの場合はfalse", () => {
    expect(isVisitorOnlyAccount([makeMember(["admin"])])).toBe(false);
  });

  it("guestのみの場合もfalse（visitorロールを持たないため）", () => {
    expect(isVisitorOnlyAccount([makeMember(["guest"])])).toBe(false);
  });
});

describe("isTechOrConductor", () => {
  it.each([[["admin"]], [["tech"]], [["conductor"]], [["member", "conductor"]]])(
    "%s は管理できる",
    (roles) => {
      expect(isTechOrConductor(makeMember(roles))).toBe(true);
    },
  );

  it.each([[["score"]], [["member", "score"]], [["member"]], [["ticket"]], [["finance"]]])(
    "%s は管理できない（同じ階層値でも score は含まない）",
    (roles) => {
      expect(isTechOrConductor(makeMember(roles))).toBe(false);
    },
  );
});
