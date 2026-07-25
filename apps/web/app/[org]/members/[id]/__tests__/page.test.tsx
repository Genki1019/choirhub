import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MemberDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { membersApi } from "@/lib/members-api";
import type { MemberProfile } from "@/lib/api-types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "member-2" }),
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    get: vi.fn(),
    updateMe: vi.fn(),
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

  it("admin: ヘッダーに「管理者操作」への導線を表示する", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    renderPage({ myMemberId: "member-self", roles: ["admin"] });

    const manageLink = await screen.findByRole("link", { name: /管理者操作/ });
    expect(manageLink).toHaveAttribute("href", "/tokyo-men-choir/members/member-2/manage");
  });

  it("admin以外: 「管理者操作」への導線を表示しない", async () => {
    vi.mocked(membersApi.get).mockResolvedValue(makeMember());
    renderPage({ myMemberId: "member-self", roles: ["member"] });

    await screen.findByText("山田太郎");
    expect(screen.queryByRole("link", { name: /管理者操作/ })).not.toBeInTheDocument();
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
