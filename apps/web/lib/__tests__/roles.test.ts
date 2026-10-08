import { describe, it, expect } from "vitest";
import { canManageTickets } from "../roles";

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
