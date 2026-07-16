import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileInfoSection } from "../ProfileInfoSection";
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
    joinedAt: null,
    email: null,
    phone: null,
    adminMemo: null,
    ...overrides,
  };
}

describe("ProfileInfoSection", () => {
  it("表示項目が1つも無い場合は何も描画しない", () => {
    const { container } = render(
      <ProfileInfoSection member={makeMember()} isMemberPlus={false} isAdmin={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("職業がある場合のみ表示する", () => {
    const { rerender } = render(
      <ProfileInfoSection
        member={makeMember({ job: "エンジニア" })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.getByText("エンジニア")).toBeInTheDocument();

    rerender(
      <ProfileInfoSection
        member={makeMember({ job: null, interests: "コーヒー" })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.queryByText("エンジニア")).not.toBeInTheDocument();
  });

  it("好きなもの・出身団体がある場合のみ表示する", () => {
    render(
      <ProfileInfoSection
        member={makeMember({ interests: "コーヒー", originGroup: "○○大学合唱団" })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.getByText("コーヒー")).toBeInTheDocument();
    expect(screen.getByText("○○大学合唱団")).toBeInTheDocument();
  });

  it("入団日はjoinedAtがある場合は日付を、無い場合は「不明入団」を表示する（他の項目があれば描画される）", () => {
    const { rerender } = render(
      <ProfileInfoSection
        member={makeMember({ job: "エンジニア", joinedAt: "2020-04-01" })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.getByText("2020年4月入団")).toBeInTheDocument();

    rerender(
      <ProfileInfoSection
        member={makeMember({ job: "エンジニア", joinedAt: null })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.getByText("不明入団")).toBeInTheDocument();
  });

  it("メンバー区分がある場合のみ表示する", () => {
    render(
      <ProfileInfoSection
        member={makeMember({
          job: "エンジニア",
          memberType: { id: "type-1", name: "正団員", defaultFeeAmount: 3000 },
        })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.getByText("正団員")).toBeInTheDocument();
  });

  it("isMemberPlus=falseの場合: メールアドレス・電話番号を表示しない", () => {
    render(
      <ProfileInfoSection
        member={makeMember({
          job: "エンジニア",
          email: "test@example.com",
          phone: "090-1234-5678",
        })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("090-1234-5678")).not.toBeInTheDocument();
  });

  it("isMemberPlus=trueの場合: メールアドレス・電話番号を表示する", () => {
    render(
      <ProfileInfoSection
        member={makeMember({
          job: "エンジニア",
          email: "test@example.com",
          phone: "090-1234-5678",
        })}
        isMemberPlus={true}
        isAdmin={false}
      />,
    );
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("090-1234-5678")).toBeInTheDocument();
  });

  it("isAdmin=falseの場合: 管理者メモを表示しない", () => {
    render(
      <ProfileInfoSection
        member={makeMember({ job: "エンジニア", adminMemo: "要注意" })}
        isMemberPlus={false}
        isAdmin={false}
      />,
    );
    expect(screen.queryByText("要注意")).not.toBeInTheDocument();
  });

  it("isAdmin=trueの場合: 管理者メモを表示する", () => {
    render(
      <ProfileInfoSection
        member={makeMember({ job: "エンジニア", adminMemo: "要注意" })}
        isMemberPlus={false}
        isAdmin={true}
      />,
    );
    expect(screen.getByText("要注意")).toBeInTheDocument();
  });
});
