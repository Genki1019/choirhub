import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileCard } from "../ProfileCard";
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

describe("ProfileCard", () => {
  it("avatarUrlがある場合: 画像を表示する", () => {
    render(<ProfileCard member={makeMember({ avatarUrl: "https://example.com/a.png" })} />);
    expect(screen.getByAltText("avatar")).toBeInTheDocument();
  });

  it("avatarUrlが無い場合: 頭文字アバターを表示する", () => {
    render(<ProfileCard member={makeMember({ nameJa: "山田太郎" })} />);
    expect(screen.queryByAltText("avatar")).not.toBeInTheDocument();
    expect(screen.getByText("山")).toBeInTheDocument();
  });

  it("partがnullの場合: 「パート未設定」を表示する", () => {
    render(<ProfileCard member={makeMember({ part: null })} />);
    expect(screen.getByText("パート未設定")).toBeInTheDocument();
  });

  it("ステータスラベルを表示する", () => {
    render(<ProfileCard member={makeMember({ status: "offstage" })} />);
    expect(screen.getByText("休団")).toBeInTheDocument();
  });

  it("member・guest・visitorロールはバッジから除外される", () => {
    render(
      <ProfileCard
        member={makeMember({ roles: ["member", "guest", "visitor", "admin", "tech"] })}
      />,
    );
    expect(screen.getByText("最高管理者")).toBeInTheDocument();
    expect(screen.getByText("技術系")).toBeInTheDocument();
    expect(screen.queryByText("一般")).not.toBeInTheDocument();
    expect(screen.queryByText("客演")).not.toBeInTheDocument();
    expect(screen.queryByText("体験")).not.toBeInTheDocument();
  });

  it("bioがある場合のみひとことセクションを表示する", () => {
    const { rerender } = render(<ProfileCard member={makeMember({ bio: null })} />);
    expect(screen.queryByText("よろしくお願いします")).not.toBeInTheDocument();

    rerender(<ProfileCard member={makeMember({ bio: "よろしくお願いします" })} />);
    expect(screen.getByText("よろしくお願いします")).toBeInTheDocument();
  });
});
