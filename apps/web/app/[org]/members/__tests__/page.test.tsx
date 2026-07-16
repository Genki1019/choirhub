import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MembersPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";
import type { MemberProfile, PartSummary } from "@/lib/api-types";
import type { MemberType } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    list: vi.fn(),
    parts: vi.fn(),
    invite: vi.fn(),
  },
}));

vi.mock("@/lib/settings-api", () => ({
  settingsApi: {
    listMemberTypes: vi.fn(),
  },
}));

const partTenor: PartSummary = { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 };
const partBass: PartSummary = { id: "part-2", name: "Bass", voiceType: "bass", sortOrder: 2 };

const memberTypeRegular: MemberType = {
  id: "type-1",
  name: "正団員",
  defaultFeeAmount: 3000,
  sortOrder: 0,
};

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: "ヤマダタロウ",
    nameEn: null,
    avatarUrl: null,
    part: partTenor,
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

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <MembersPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([partTenor, partBass]);
  vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([memberTypeRegular]);
});

describe("MembersPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(membersApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.list).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("組織にパートが1つも無く該当メンバーも0件の場合は「該当するメンバーがいません」を表示する", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    vi.mocked(membersApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("該当するメンバーがいません")).toBeInTheDocument();
  });

  it("フィルタ後に一致するメンバーが0人でも、組織にパートがあれば0名のセクションが並ぶ", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.queryByText("該当するメンバーがいません")).not.toBeInTheDocument();
  });
});

describe("MembersPage（パートごとのグルーピング）", () => {
  it("パートごとにグルーピングし、人数を表示する", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({ id: "member-1", nameJa: "山田太郎", part: partTenor }),
      makeMember({ id: "member-2", nameJa: "佐藤花子", nameKana: "サトウハナコ", part: partTenor }),
      makeMember({
        id: "member-3",
        nameJa: "鈴木一郎",
        nameKana: "スズキイチロウ",
        part: partBass,
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.getByText("2名")).toBeInTheDocument();
    expect(screen.getByText("1名")).toBeInTheDocument();
  });

  it("パート未設定のメンバーは「パート未設定」グループに入る", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({ id: "member-1", nameJa: "田中次郎", nameKana: null, part: null }),
    ]);
    renderPage();

    expect(await screen.findByText("パート未設定")).toBeInTheDocument();
    expect(screen.getByText("田中次郎")).toBeInTheDocument();
  });
});

describe("MembersPage（フィルタ）", () => {
  it("ステータスフィルタで絞り込める", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({ id: "member-1", nameJa: "在団太郎", status: "active" }),
      makeMember({ id: "member-2", nameJa: "休団花子", status: "offstage" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("在団太郎");
    expect(screen.queryByText("休団花子")).not.toBeInTheDocument();

    const statusSelect = screen.getByDisplayValue("在団");
    await user.selectOptions(statusSelect, "offstage");

    expect(await screen.findByText("休団花子")).toBeInTheDocument();
    expect(screen.queryByText("在団太郎")).not.toBeInTheDocument();
  });

  it("メンバー区分フィルタで絞り込める", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({ id: "member-1", nameJa: "区分あり", memberType: memberTypeRegular }),
      makeMember({ id: "member-2", nameJa: "区分なし", memberType: null }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("区分あり");
    expect(screen.getByText("区分なし")).toBeInTheDocument();

    const typeSelect = screen.getByDisplayValue("全区分");
    await user.selectOptions(typeSelect, "type-1");

    expect(await screen.findByText("区分あり")).toBeInTheDocument();
    expect(screen.queryByText("区分なし")).not.toBeInTheDocument();
  });

  it("メンバー区分が0件のときは区分フィルタを表示しない", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([]);
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    renderPage();

    await screen.findByText("山田太郎");
    expect(screen.queryByText("全区分")).not.toBeInTheDocument();
  });
});

describe("MembersPage（ソート）", () => {
  it("並び替えセレクトで表示順が変わる（名前順 → 入団が新しい順）", async () => {
    // 名前順では 青木 が先、入団が新しい順では joinedAt が新しい 山田 が先になるよう
    // あえて名前順と入団日順で結果が逆転する組み合わせにしている
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({
        id: "member-1",
        nameJa: "山田太郎",
        nameKana: "ヤマダタロウ",
        joinedAt: "2023-04-01",
      }),
      makeMember({
        id: "member-2",
        nameJa: "青木次郎",
        nameKana: "アオキジロウ",
        joinedAt: "2018-04-01",
      }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("山田太郎");
    // 名前順（デフォルト）: アオキ → ヤマダ
    let names = screen.getAllByRole("link").map((el) => el.textContent);
    expect(names.findIndex((t) => t?.includes("青木次郎"))).toBeLessThan(
      names.findIndex((t) => t?.includes("山田太郎")),
    );

    const sortSelect = screen.getByDisplayValue("名前順");
    await user.selectOptions(sortSelect, "joinedAt_desc");

    // 入団が新しい順: 山田（2023）→ 青木（2018）と順序が逆転する
    names = screen.getAllByRole("link").map((el) => el.textContent);
    expect(names.findIndex((t) => t?.includes("山田太郎"))).toBeLessThan(
      names.findIndex((t) => t?.includes("青木次郎")),
    );
  });
});

describe("MembersPage（招待、権限）", () => {
  it("admin: 「メンバーを招待」ボタンを表示する", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    renderPage(["admin"]);

    expect(await screen.findByText("メンバーを招待")).toBeInTheDocument();
  });

  it("admin以外: 「メンバーを招待」ボタンを表示しない", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("Tenor I");
    expect(screen.queryByText("メンバーを招待")).not.toBeInTheDocument();
  });

  it("招待ボタンクリックでInviteModalが開く", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("メンバーを招待"));

    expect(screen.getByRole("heading", { name: "メンバーを招待" })).toBeInTheDocument();
  });
});
