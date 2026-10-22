import { describe, it, expect } from "vitest";
import { canManageOnstage, canManageTickets, isMemberPlus } from "../roles";

describe("canManageTickets", () => {
  it.each([[["admin"]], [["ticket"]], [["member", "ticket"]]])("%s は管理できる", (roles) => {
    expect(canManageTickets(roles)).toBe(true);
  });

  it.each([[["member"]], [["finance"]], [["tech"]], [["guest"]], [["visitor"]], [[]]])(
    "%s は管理できない",
    (roles) => {
      expect(canManageTickets(roles)).toBe(false);
    },
  );
});

describe("canManageOnstage", () => {
  it.each([[["admin"]], [["tech"]], [["conductor"]], [["member", "conductor"]]])(
    "%s は管理できる",
    (roles) => {
      expect(canManageOnstage(roles)).toBe(true);
    },
  );

  it.each([[["score"]], [["member", "score"]], [["member"]], [["ticket"]], [["guest"]]])(
    "%s は管理できない",
    (roles) => {
      expect(canManageOnstage(roles)).toBe(false);
    },
  );
});

describe("isMemberPlus", () => {
  it.each([[["member"]], [["admin"]], [["finance"]], [["guest", "member"]]])(
    "%s は一般団員以上",
    (roles) => {
      expect(isMemberPlus(roles)).toBe(true);
    },
  );

  it.each([[["guest"]], [["visitor"]], [[]]])("%s は一般団員以上ではない", (roles) => {
    expect(isMemberPlus(roles)).toBe(false);
  });
});
