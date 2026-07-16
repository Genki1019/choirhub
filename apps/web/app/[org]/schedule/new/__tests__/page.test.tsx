import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewSchedulePage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/events-api", () => ({
  eventsApi: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    parts: vi.fn(),
  },
}));

vi.mock("@/lib/settings-api", () => ({
  settingsApi: {
    listEventCategories: vi.fn(),
  },
}));

const categories = [
  { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
  { id: "cat-2", name: "本番", slug: "concert", color: "#EF4444", sortOrder: 1 },
];

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <NewSchedulePage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([]);
  vi.mocked(settingsApi.listEventCategories).mockResolvedValue(categories);
});

describe("NewSchedulePage（権限・表示状態）", () => {
  it.each([["member"], ["guest"], ["score"]])(
    "%sロール: アクセス権限がありませんと表示する",
    (role) => {
      renderPage([role]);
      expect(screen.getByText("このページにアクセスする権限がありません")).toBeInTheDocument();
    },
  );

  it("admin: ローディング中は「読み込み中...」を表示する", () => {
    vi.mocked(membersApi.parts).mockReturnValue(new Promise(() => {}));
    renderPage(["admin"]);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("初期化エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(settingsApi.listEventCategories).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage(["admin"]);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });
});

describe("NewSchedulePage（カテゴリ選択）", () => {
  it("デフォルトで最初のカテゴリが選択される", async () => {
    renderPage(["admin"]);
    const rehearsalChip = await screen.findByText("練習");
    expect(rehearsalChip).toHaveClass("bg-brand-600");
  });

  it("クリックでカテゴリの選択が切り替わる", async () => {
    const user = userEvent.setup();
    renderPage(["admin"]);

    const concertChip = await screen.findByText("本番");
    await user.click(concertChip);
    expect(concertChip).toHaveClass("bg-brand-600");
    expect(screen.getByText("練習")).not.toHaveClass("bg-brand-600");
  });
});

describe("NewSchedulePage（バリデーション）", () => {
  it("タイトル未入力で送信: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("練習");
    await user.click(screen.getByText("作成する"));

    expect(await screen.findByText("タイトルを入力してください。")).toBeInTheDocument();
    expect(eventsApi.create).not.toHaveBeenCalled();
  });

  it("締切トグルON・締切日未入力で送信: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("練習");
    await user.type(screen.getByPlaceholderText("タイトルを追加 *"), "第12回定期練習");
    await user.click(screen.getByLabelText("出欠締切を設定する"));
    await user.click(screen.getByText("作成する"));

    expect(await screen.findByText("締切日を選択してください。")).toBeInTheDocument();
    expect(eventsApi.create).not.toHaveBeenCalled();
  });
});

describe("NewSchedulePage（開始日と終了日の連動）", () => {
  it("開始日を変更すると終了日も追従する", async () => {
    renderPage(["admin"]);
    await screen.findByText("練習");

    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-08-01" } });

    expect(screen.getByLabelText("終了日")).toHaveValue("2026-08-01");
  });
});

describe("NewSchedulePage（送信）", () => {
  it("送信成功: eventsApi.createが正しいペイロードで呼ばれ/scheduleへ遷移する", async () => {
    vi.mocked(eventsApi.create).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("練習");
    await user.type(screen.getByPlaceholderText("タイトルを追加 *"), "第12回定期練習");
    await user.click(screen.getByText("作成する"));

    await waitFor(() => {
      expect(eventsApi.create).toHaveBeenCalledWith(
        "tokyo-men-choir",
        expect.objectContaining({
          title: "第12回定期練習",
          categoryId: "cat-1",
          targetRoles: null,
          targetPartIds: null,
          deadline: null,
        }),
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/schedule");
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(eventsApi.create).mockRejectedValue(new Error("作成に失敗しました。"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("練習");
    await user.type(screen.getByPlaceholderText("タイトルを追加 *"), "第12回定期練習");
    await user.click(screen.getByText("作成する"));

    expect(await screen.findByText("作成に失敗しました。")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
