import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MemberManagePage from "../page";
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

function renderPage(opts: { roles?: string[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={opts.roles ?? ["member"]}>
        <MemberManagePage />
      </MemberProvider>
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.get).mockResolvedValue(makeMember());
  vi.mocked(membersApi.parts).mockResolvedValue([
    { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
  ]);
  vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([]);
});

describe("MemberManagePage（権限ガード）", () => {
  it("admin以外は「このページにアクセスする権限がありません」を表示し、データ取得しない", async () => {
    renderPage({ roles: ["member"] });

    expect(await screen.findByText("このページにアクセスする権限がありません")).toBeInTheDocument();
    expect(membersApi.get).not.toHaveBeenCalled();
    expect(membersApi.parts).not.toHaveBeenCalled();
    expect(settingsApi.listMemberTypes).not.toHaveBeenCalled();
  });

  it("adminは管理者操作パネルを表示する", async () => {
    renderPage({ roles: ["admin"] });

    expect(await screen.findByLabelText("管理者メモ")).toBeInTheDocument();
    await waitFor(() => {
      expect(membersApi.parts).toHaveBeenCalled();
      expect(settingsApi.listMemberTypes).toHaveBeenCalled();
    });
  });

  it("adminには編集対象が分かるよう基本情報（氏名・パート）を表示する", async () => {
    renderPage({ roles: ["admin"] });

    expect(await screen.findByText("山田太郎")).toBeInTheDocument();
    expect(screen.getAllByText("Tenor I").length).toBeGreaterThan(0);
  });
});

describe("MemberManagePage（管理者操作）", () => {
  it("変更を保存すると、一覧無効化後にメンバー詳細画面へ遷移する", async () => {
    vi.mocked(membersApi.updateById).mockResolvedValue(makeMember());
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage({ roles: ["admin"] });

    await user.click(await screen.findByText("変更を保存"));

    await waitFor(() => {
      expect(membersApi.updateById).toHaveBeenCalled();
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["members", "tokyo-men-choir"],
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/members/member-2");
  });

  it("退団処理: confirmでキャンセルした場合はAPIを呼ばない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderPage({ roles: ["admin"] });

    await user.click(await screen.findByText("退団処理"));

    expect(membersApi.delete).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("退団処理: confirmでOKした場合は削除後にメンバー一覧へ遷移する", async () => {
    vi.mocked(membersApi.delete).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage({ roles: ["admin"] });

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
