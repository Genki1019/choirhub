import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MembersPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";
import type { MemberProfile, PartSummary } from "@/lib/api-types";
import type { MemberType } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    list: vi.fn(),
    parts: vi.fn(),
    invite: vi.fn(),
    exportCsv: vi.fn(),
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
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <MembersPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

beforeEach(() => {
  vi.resetAllMocks();
  searchParams = new URLSearchParams();
  vi.mocked(membersApi.parts).mockResolvedValue([partTenor, partBass]);
  vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([memberTypeRegular]);
});

describe("MembersPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(membersApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("データ取得中も見出しとフィルタ行を残し、読み込み表示は1つだけ出す", () => {
    vi.mocked(membersApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("heading", { name: "メンバー" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(screen.getAllByText("読み込み中...")).toHaveLength(1);
    expect(screen.queryByText(/^\d+名$/)).not.toBeInTheDocument();
  });

  it("取得エラー時は 4xx ならサーバーの理由を表示する", async () => {
    vi.mocked(membersApi.list).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "この団体へのアクセス権限がありません", 403),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この団体へのアクセス権限がありません",
    );
  });

  it("取得エラー時は 5xx でも日本語の理由を表示し、一覧・空表示・件数を出さない", async () => {
    vi.mocked(membersApi.list).mockRejectedValue(new ApiClientError("INTERNAL", "", 500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メンバーの読み込みに失敗しました。ページを再読み込みしてください。",
    );
    expect(screen.queryByText("Tenor I")).not.toBeInTheDocument();
    expect(screen.queryByText("該当するメンバーがいません")).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+名$/)).not.toBeInTheDocument();
  });

  it("パートの取得に失敗しても、理由を出して団員をパートごとに表示する", async () => {
    vi.mocked(membersApi.parts).mockRejectedValue(new ApiClientError("INTERNAL", "", 500));
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({ id: "member-1", nameJa: "山田太郎", part: partTenor }),
      makeMember({
        id: "member-2",
        nameJa: "鈴木一郎",
        nameKana: "スズキイチロウ",
        part: partBass,
      }),
    ]);
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("パートの読み込みに失敗しました");
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("鈴木一郎")).toBeInTheDocument();
    expect(screen.getByText("2名")).toBeInTheDocument();
  });

  it("取得済みのあとで裏の取り直しだけが失敗しても、一覧を残してエラーを出さない", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember({ nameJa: "山田太郎" })]);
    const { queryClient } = renderPage();
    expect(await screen.findByText("山田太郎")).toBeInTheDocument();

    vi.mocked(membersApi.list).mockRejectedValue(new ApiClientError("INTERNAL", "", 500));
    vi.mocked(membersApi.parts).mockRejectedValue(new ApiClientError("INTERNAL", "", 500));
    await act(async () => {
      await queryClient.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("パートだけ裏の取り直しに失敗しても、パートの一覧とグループを残してエラーを出さない", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember({ nameJa: "山田太郎" })]);
    const { queryClient } = renderPage();
    expect(await screen.findByText("Bass")).toBeInTheDocument();

    vi.mocked(membersApi.parts).mockRejectedValue(new ApiClientError("INTERNAL", "", 500));
    await act(async () => {
      await queryClient.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("メンバー区分の取得に失敗すると、理由を出して一覧はそのまま表示する", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockRejectedValue(
      new ApiClientError("INTERNAL", "", 500),
    );
    vi.mocked(membersApi.list).mockResolvedValue([makeMember({ nameJa: "山田太郎" })]);
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メンバー区分の読み込みに失敗しました",
    );
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
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

describe("MembersPage（URL の在籍状況）", () => {
  it("URL の status が選択肢にあれば、その状況で絞り込む", async () => {
    searchParams = new URLSearchParams("status=offstage");
    vi.mocked(membersApi.list).mockResolvedValue([
      makeMember({ id: "member-1", nameJa: "在団太郎", status: "active" }),
      makeMember({ id: "member-2", nameJa: "休団花子", status: "offstage" }),
    ]);
    renderPage();

    expect(await screen.findByText("休団花子")).toBeInTheDocument();
    expect(screen.queryByText("在団太郎")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "在籍状況" })).toHaveValue("offstage");
  });

  it.each(["status=foo", "status="])(
    "URL の status が選択肢にない（%s）ときは、在団で絞り込み選択欄も在団にする",
    async (query) => {
      searchParams = new URLSearchParams(query);
      vi.mocked(membersApi.list).mockResolvedValue([
        makeMember({ id: "member-1", nameJa: "在団太郎", status: "active" }),
        makeMember({ id: "member-2", nameJa: "休団花子", status: "offstage" }),
      ]);
      renderPage();

      expect(await screen.findByText("在団太郎")).toBeInTheDocument();
      expect(screen.queryByText("休団花子")).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "在籍状況" })).toHaveValue("active");
    },
  );
});

describe("MembersPage（表示の切り替えと選択欄の名前）", () => {
  it("表示切り替えのボタンに名前があり、選択中だけ押された状態になる", async () => {
    const user = userEvent.setup();
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    renderPage();

    const card = await screen.findByRole("button", { name: "カード表示" });
    const list = screen.getByRole("button", { name: "リスト表示" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(list).toHaveAttribute("aria-pressed", "false");

    await user.click(list);
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(list).toHaveAttribute("aria-pressed", "true");
  });

  it("絞り込み・並び替えの選択欄に名前がある", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    renderPage();

    expect(await screen.findByRole("combobox", { name: "メンバー区分" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "在籍状況" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "並び順" })).toBeInTheDocument();
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

  it("admin: 「CSV出力」クリックで名簿CSVをダウンロードする", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    vi.mocked(membersApi.exportCsv).mockResolvedValue();
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByRole("button", { name: "CSV出力" }));
    expect(membersApi.exportCsv).toHaveBeenCalledWith("tokyo-men-choir");
  });

  it("admin以外: 「CSV出力」ボタンを表示しない", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("Tenor I");
    expect(screen.queryByRole("button", { name: "CSV出力" })).not.toBeInTheDocument();
  });

  it("招待ボタンクリックでInviteModalが開く", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("メンバーを招待"));

    expect(screen.getByRole("heading", { name: "メンバーを招待" })).toBeInTheDocument();
  });
});
