import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewConcertPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { concertsApi } from "@/lib/concerts-api";
import { membersApi } from "@/lib/members-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      create: vi.fn(),
    },
  };
});

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    parts: vi.fn(),
  },
}));

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <NewConcertPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([]);
});

describe("NewConcertPage（権限・表示状態）", () => {
  it.each([["member"], ["guest"], ["score"]])(
    "%sロール: アクセス権限がありませんと表示する",
    (role) => {
      renderPage([role]);
      expect(screen.getByText("このページにアクセスする権限がありません")).toBeInTheDocument();
    },
  );

  it.each([["admin"], ["tech"], ["conductor"]])("%sロール: フォームを表示する", async (role) => {
    renderPage([role]);
    expect(await screen.findByText("演奏会を登録")).toBeInTheDocument();
  });

  it("admin: ローディング中は「読み込み中...」を表示する", () => {
    vi.mocked(membersApi.parts).mockReturnValue(new Promise(() => {}));
    renderPage(["admin"]);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("初期化エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.parts).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage(["admin"]);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });
});

describe("NewConcertPage（種別表示）", () => {
  it("種別チップは「本番」固定で表示される", async () => {
    renderPage(["admin"]);
    expect(await screen.findByText("本番")).toBeInTheDocument();
  });
});

describe("NewConcertPage（バリデーション）", () => {
  it("タイトル未入力で送信: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("本番");
    await user.click(screen.getByText("登録する"));

    expect(await screen.findByText("タイトルを入力してください。")).toBeInTheDocument();
    expect(concertsApi.create).not.toHaveBeenCalled();
  });
});

describe("NewConcertPage（開始日と終了日の連動）", () => {
  it("開始日を変更すると終了日も追従する", async () => {
    renderPage(["admin"]);
    await screen.findByText("本番");

    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-11-23" } });

    expect(screen.getByLabelText("終了日")).toHaveValue("2026-11-23");
  });
});

describe("NewConcertPage（送信）", () => {
  it("送信成功: concertsApi.createが正しいペイロードで呼ばれ詳細ページへ遷移する", async () => {
    vi.mocked(concertsApi.create).mockResolvedValue({ id: "concert-new" } as never);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("本番");
    await user.type(
      screen.getByPlaceholderText("タイトルを追加（例: 第21回定期演奏会）*"),
      "第21回定期演奏会",
    );
    await user.click(screen.getByText("登録する"));

    await waitFor(() => {
      expect(concertsApi.create).toHaveBeenCalledWith(
        "tokyo-men-choir",
        expect.objectContaining({
          title: "第21回定期演奏会",
          targetRoles: null,
          targetPartIds: null,
          deadline: null,
        }),
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/concerts/concert-new");
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.create).mockRejectedValue(new Error("作成に失敗しました。"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("本番");
    await user.type(
      screen.getByPlaceholderText("タイトルを追加（例: 第21回定期演奏会）*"),
      "第21回定期演奏会",
    );
    await user.click(screen.getByText("登録する"));

    expect(await screen.findByText("作成に失敗しました。")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
