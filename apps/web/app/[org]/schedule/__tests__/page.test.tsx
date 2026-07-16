import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SchedulePage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { eventsApi } from "@/lib/events-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/events-api", () => ({
  eventsApi: {
    list: vi.fn(),
  },
}));

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <SchedulePage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.setSystemTime(new Date("2026-07-16T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SchedulePage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(eventsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(eventsApi.list).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("取得成功時はカレンダーの見出し年月を表示する", async () => {
    vi.mocked(eventsApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("2026年 7月")).toBeInTheDocument();
  });
});

describe("SchedulePage（イベント追加ボタンの権限）", () => {
  it.each([["admin"], ["tech"], ["conductor"]])(
    "%sロール: 「イベントを追加」ボタンを表示する",
    async (role) => {
      vi.mocked(eventsApi.list).mockResolvedValue([]);
      renderPage([role]);

      expect(await screen.findByText("イベントを追加")).toBeInTheDocument();
    },
  );

  it("member/guest/visitor等: 「イベントを追加」ボタンを表示しない", async () => {
    vi.mocked(eventsApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("2026年 7月");
    expect(screen.queryByText("イベントを追加")).not.toBeInTheDocument();
  });
});

describe("SchedulePage（月ナビゲーション）", () => {
  it("「次の月」クリックで翌月に切り替わる（年をまたぐ場合は年も繰り上がる）", async () => {
    vi.mocked(eventsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("2026年 7月");
    // 12月まで5回進めて年またぎを検証
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByLabelText("次の月"));
    }
    expect(await screen.findByText("2026年 12月")).toBeInTheDocument();

    await user.click(screen.getByLabelText("次の月"));
    expect(await screen.findByText("2027年 1月")).toBeInTheDocument();
  });

  it("「前の月」クリックで前月に切り替わる（年をまたぐ場合は年も繰り下がる）", async () => {
    vi.mocked(eventsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("2026年 7月");
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByLabelText("前の月"));
    }
    expect(await screen.findByText("2026年 1月")).toBeInTheDocument();

    await user.click(screen.getByLabelText("前の月"));
    expect(await screen.findByText("2025年 12月")).toBeInTheDocument();
  });
});
