import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberCard, MemberRow } from "../MemberCard";
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-16T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MemberCard", () => {
  it("avatarUrlがある場合: 画像を表示する", () => {
    render(
      <MemberCard member={makeMember({ avatarUrl: "https://example.com/a.png" })} org="tokyo" />,
    );
    expect(screen.getByAltText("avatar")).toBeInTheDocument();
  });

  it("avatarUrlが無い場合: 頭文字アバターを表示する", () => {
    render(<MemberCard member={makeMember({ nameJa: "山田太郎" })} org="tokyo" />);
    expect(screen.queryByAltText("avatar")).not.toBeInTheDocument();
    expect(screen.getByText("山")).toBeInTheDocument();
  });

  it("status=activeの場合: 「在団」を表示する", () => {
    render(<MemberCard member={makeMember({ status: "active" })} org="tokyo" />);
    expect(screen.getByText("在団")).toBeInTheDocument();
  });

  it("status=offstageの場合: 「休団」を表示する", () => {
    render(<MemberCard member={makeMember({ status: "offstage" })} org="tokyo" />);
    expect(screen.getByText("休団")).toBeInTheDocument();
  });

  it("在籍年数を表示する", () => {
    render(<MemberCard member={makeMember({ joinedAt: "2020-04-01" })} org="tokyo" />);
    expect(screen.getByText("6年在籍")).toBeInTheDocument();
  });

  it("memberロールはバッジ表示から除外され、admin/techは表示される", () => {
    render(<MemberCard member={makeMember({ roles: ["member", "admin", "tech"] })} org="tokyo" />);
    expect(screen.getByText("管理者")).toBeInTheDocument();
    expect(screen.getByText("技術系")).toBeInTheDocument();
    expect(screen.queryByText("一般")).not.toBeInTheDocument();
  });

  it("リンク先が/[org]/members/[id]になる", () => {
    render(<MemberCard member={makeMember({ id: "member-42" })} org="tokyo" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tokyo/members/member-42");
  });
});

describe("MemberRow", () => {
  it("名前・パート・ステータス・入団年月を表示する", () => {
    render(
      <MemberRow member={makeMember({ nameJa: "山田太郎", joinedAt: "2020-04-01" })} org="tokyo" />,
    );
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("在団")).toBeInTheDocument();
    expect(screen.getByText("2020年4月入団")).toBeInTheDocument();
  });

  it("partがnullの場合: 「パート未設定」を表示する", () => {
    render(<MemberRow member={makeMember({ part: null })} org="tokyo" />);
    expect(screen.getByText("パート未設定")).toBeInTheDocument();
  });

  it("joinedAtがnullの場合: 「不明入団」を表示する", () => {
    render(<MemberRow member={makeMember({ joinedAt: null })} org="tokyo" />);
    expect(screen.getByText("不明入団")).toBeInTheDocument();
  });

  it("リンク先が/[org]/members/[id]になる", () => {
    render(<MemberRow member={makeMember({ id: "member-42" })} org="tokyo" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tokyo/members/member-42");
  });
});
