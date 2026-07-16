import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MemberDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";
import type { MemberProfile } from "@/lib/api-types";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "member-2" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    get: vi.fn(),
    parts: vi.fn(),
    updateMe: vi.fn(),
    updateById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/settings-api", () => ({
  settingsApi: {
    listMemberTypes: vi.fn(),
  },
}));

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-2",
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

function renderPage(opts: { myMemberId?: string; roles?: string[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
  render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId={opts.myMemberId ?? "member-self"} roles={opts.roles ?? ["member"]}>
        <MemberDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
  return { invalidateSpy, setQueryDataSpy };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([
    { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
  ]);
  vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([]);
});

describe("MemberDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(membersApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("メンバーがnullの場合は「メンバーが見つかりません」を表示する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(membersApi.get).mockResolvedValue(null as any);
    renderPage();

    expect(await screen.findByText("メンバーが見つかりません")).toBeInTheDocument();
  });
});

describe("MemberDetailPage（権限分岐）", () => {
  it("自分自身かつ非編集時: ヘッダーに「編集」ボタンを表示する", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    renderPage({ myMemberId: "member-2" });

    expect(await screen.findByText("編集")).toBeInTheDocument();
  });

  it("自分以外の場合: 「編集」ボタンを表示しない", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    renderPage({ myMemberId: "member-self" });

    await screen.findByText("山田太郎");
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
  });

  it("admin: AdminPanelを表示し、parts・memberTypesを取得する", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    renderPage({ myMemberId: "member-self", roles: ["admin"] });

    expect(await screen.findByText("管理者操作")).toBeInTheDocument();
    await waitFor(() => {
      expect(membersApi.parts).toHaveBeenCalled();
      expect(settingsApi.listMemberTypes).toHaveBeenCalled();
    });
  });

  it("admin以外: AdminPanelを表示せず、parts・memberTypesも取得しない", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    renderPage({ myMemberId: "member-self", roles: ["member"] });

    await screen.findByText("山田太郎");
    expect(screen.queryByText("管理者操作")).not.toBeInTheDocument();
    expect(membersApi.parts).not.toHaveBeenCalled();
    expect(settingsApi.listMemberTypes).not.toHaveBeenCalled();
  });
});

describe("MemberDetailPage（自己編集フロー）", () => {
  it("「編集」クリックでEditFormに切り替わる", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    const user = userEvent.setup();
    renderPage({ myMemberId: "member-2" });

    await user.click(await screen.findByText("編集"));

    expect(screen.getByText("プロフィール編集")).toBeInTheDocument();
  });

  it("保存すると、キャッシュ更新・一覧無効化・編集モード終了する", async () => {
    const member = makeMember();
    vi.mocked(membersApi.get).mockResolvedValue(member);
    vi.mocked(membersApi.updateMe).mockResolvedValue({ ...member, bio: "更新後" });
    const user = userEvent.setup();
    const { invalidateSpy, setQueryDataSpy } = renderPage({ myMemberId: "member-2" });

    await user.click(await screen.findByText("編集"));
    await user.click(screen.getByText("保存する"));

    await waitFor(() => {
      expect(membersApi.updateMe).toHaveBeenCalled();
    });
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      ["member", "tokyo-men-choir", "member-2"],
      expect.objectContaining({ bio: "更新後" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["members", "tokyo-men-choir"],
    });
    expect(screen.queryByText("プロフィール編集")).not.toBeInTheDocument();
  });
});

describe("MemberDetailPage（管理者操作）", () => {
  it("変更を保存すると、一覧無効化後にステータス付きの一覧へ遷移する", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember({ status: "active" }));
    vi.mocked(membersApi.updateById).mockResolvedValue(makeMember());
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage({ myMemberId: "member-self", roles: ["admin"] });

    await user.click(await screen.findByText("変更を保存"));

    await waitFor(() => {
      expect(membersApi.updateById).toHaveBeenCalled();
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["members", "tokyo-men-choir"],
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/members?status=active");
  });

  it("退団処理: confirmでキャンセルした場合はAPIを呼ばない", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderPage({ myMemberId: "member-self", roles: ["admin"] });

    await user.click(await screen.findByText("退団処理"));

    expect(membersApi.delete).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("退団処理: confirmでOKした場合は削除後に一覧へ遷移する", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    vi.mocked(membersApi.delete).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage({ myMemberId: "member-self", roles: ["admin"] });

    await user.click(await screen.findByText("退団処理"));

    await waitFor(() => {
      expect(membersApi.delete).toHaveBeenCalledWith("tokyo-men-choir", "member-2");
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["members", "tokyo-men-choir"],
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/members");
  });
});
