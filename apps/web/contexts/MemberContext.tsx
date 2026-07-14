"use client";

import { createContext, useContext } from "react";

interface MemberContextValue {
  memberId: string;
  roles: string[];
}

const MemberContext = createContext<MemberContextValue | null>(null);

export function MemberProvider({
  memberId,
  roles,
  children,
}: MemberContextValue & { children: React.ReactNode }) {
  return <MemberContext.Provider value={{ memberId, roles }}>{children}</MemberContext.Provider>;
}

export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMember must be used inside MemberProvider");
  return ctx;
}
