import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberPartSection } from "../MemberPartSection";
import type { MemberProfile } from "@/lib/api-types";

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: "ヤマダタロウ",
    nameEn: null,
    avatarUrl: null,
    part: { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: "2020-04-01",
    ...overrides,
  };
}

describe("MemberPartSection", () => {
  it("パート名と人数を表示する", () => {
    render(
      <MemberPartSection
        partId="part-1"
        partName="Tenor I"
        members={[makeMember(), makeMember({ id: "member-2" })]}
        viewMode="card"
        org="tokyo"
      />,
    );
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("2名")).toBeInTheDocument();
  });

  it("partIdが__unassigned__の場合: 見出しの文字色が変わる", () => {
    render(
      <MemberPartSection
        partId="__unassigned__"
        partName="パート未設定"
        members={[makeMember()]}
        viewMode="card"
        org="tokyo"
      />,
    );
    expect(screen.getByText("パート未設定")).toHaveClass("text-gray-400");
  });

  it("通常のパートの場合: 見出しの文字色は__unassigned__と異なる", () => {
    render(
      <MemberPartSection
        partId="part-1"
        partName="Tenor I"
        members={[makeMember()]}
        viewMode="card"
        org="tokyo"
      />,
    );
    expect(screen.getByText("Tenor I")).not.toHaveClass("text-gray-400");
  });

  it("viewMode=cardの場合: MemberCard（リンクにパート名を含む）を並べる", () => {
    render(
      <MemberPartSection
        partId="part-1"
        partName="Tenor I"
        members={[makeMember({ id: "member-1", nameJa: "山田太郎" })]}
        viewMode="card"
        org="tokyo"
      />,
    );
    // MemberCard は在籍年数表記を持つ（MemberRow には無い）
    expect(screen.getByText(/年在籍/)).toBeInTheDocument();
  });

  it("viewMode=listの場合: MemberRowを並べる", () => {
    render(
      <MemberPartSection
        partId="part-1"
        partName="Tenor I"
        members={[makeMember({ id: "member-1", nameJa: "山田太郎", joinedAt: "2020-04-01" })]}
        viewMode="list"
        org="tokyo"
      />,
    );
    // MemberRow は入団年月表記を持つ（MemberCard には無い）
    expect(screen.getByText("2020年4月入団")).toBeInTheDocument();
    expect(screen.queryByText(/年在籍/)).not.toBeInTheDocument();
  });
});
