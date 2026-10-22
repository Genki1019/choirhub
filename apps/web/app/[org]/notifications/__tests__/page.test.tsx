import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationsPage from "../page";
import {
  notificationsApi,
  type NotificationItem,
  type NotificationListResponse,
} from "@/lib/notifications-api";
import { ApiClientError } from "@/lib/api-client";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/notifications-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/notifications-api")>("@/lib/notifications-api");
  return {
    ...actual,
    notificationsApi: {
      list: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
    },
  };
});

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notif-1",
    type: "mailing_received",
    title: "6月練習のご案内",
    body: "みなさんこんにちは",
    link: "/mailing/mail-1",
    readAt: null,
    createdAt: "2026-05-30T10:00:00+09:00",
    ...overrides,
  };
}

function makeResponse(
  data: NotificationItem[],
  meta = { total: data.length, page: 1, perPage: 20, unreadCount: data.length },
): NotificationListResponse {
  return { data, meta };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("NotificationsPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(notificationsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("0件の場合は空表示を出す", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse([]));
    renderPage();

    expect(await screen.findByText("通知はありません")).toBeInTheDocument();
  });
});

describe("NotificationsPage（一覧表示）", () => {
  it("通知と総件数を表示する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse([makeItem()]));
    renderPage();

    expect(await screen.findByText("6月練習のご案内")).toBeInTheDocument();
    expect(screen.getByText("1件")).toBeInTheDocument();
  });

  it("ページネーション: 21件以上ある場合はクリックでページが変わる", async () => {
    vi.mocked(notificationsApi.list).mockImplementation((_org, params) =>
      Promise.resolve(
        makeResponse([makeItem({ id: `notif-${params?.page}`, title: `通知${params?.page}` })], {
          total: 25,
          page: params?.page ?? 1,
          perPage: 20,
          unreadCount: 25,
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("通知1")).toBeInTheDocument();
    await user.click(screen.getByLabelText("次のページ"));

    expect(await screen.findByText("通知2")).toBeInTheDocument();
    expect(notificationsApi.list).toHaveBeenLastCalledWith("tokyo-men-choir", {
      page: 2,
      perPage: 20,
      status: "all",
    });
  });

  it("未読通知をクリックすると既読化しリンク先へ遷移する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse([makeItem()]));
    vi.mocked(notificationsApi.markRead).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("6月練習のご案内"));

    expect(notificationsApi.markRead).toHaveBeenCalledWith("tokyo-men-choir", "notif-1");
    expect(push).toHaveBeenCalledWith("/tokyo-men-choir/mailing/mail-1");
  });

  it("既読済みの通知をクリックしても既読化APIは呼ばれない", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse([makeItem({ readAt: "2026-05-30T11:00:00+09:00" })]),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("6月練習のご案内"));

    expect(notificationsApi.markRead).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/tokyo-men-choir/mailing/mail-1");
  });
});

describe("NotificationsPage（絞り込み）", () => {
  it("「未読」タブをクリックするとstatus=unreadで再取得しページが1に戻る", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse([makeItem()], { total: 25, page: 1, perPage: 20, unreadCount: 1 }),
    );
    const user = userEvent.setup();
    renderPage();

    // 先にページ2へ進めてから絞り込みを変更し、ページが1へリセットされることを検証する
    await screen.findByText("6月練習のご案内");
    await user.click(screen.getByLabelText("次のページ"));
    await waitFor(() =>
      expect(notificationsApi.list).toHaveBeenLastCalledWith("tokyo-men-choir", {
        page: 2,
        perPage: 20,
        status: "all",
      }),
    );

    await user.click(screen.getByText("未読"));

    await waitFor(() =>
      expect(notificationsApi.list).toHaveBeenLastCalledWith("tokyo-men-choir", {
        page: 1,
        perPage: 20,
        status: "unread",
      }),
    );
  });

  it("「既読」タブで0件の場合は専用の空状態メッセージを表示する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse([]));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("通知はありません");
    await user.click(screen.getByText("既読"));

    expect(await screen.findByText("既読の通知はありません")).toBeInTheDocument();
  });
});

describe("NotificationsPage（取得エラー・再取得中）", () => {
  it("取得の失敗が4xxならAPIの理由を表示し、件数は出さない", async () => {
    vi.mocked(notificationsApi.list).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "statusの指定が不正です", 400),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("statusの指定が不正です");
    expect(screen.queryByText("0件")).not.toBeInTheDocument();
    expect(screen.queryByText("通知はありません")).not.toBeInTheDocument();
  });

  it("取得の失敗が5xxでも空でない文言を表示する", async () => {
    vi.mocked(notificationsApi.list).mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "通知の読み込みに失敗しました。ページを再読み込みしてください。",
    );
  });

  it("タブを切り替えて読み込んでいる間も、タブと直前の一覧を残し、前のタブの件数や新しいタブの空状態を出さない", async () => {
    vi.mocked(notificationsApi.list)
      .mockResolvedValueOnce(
        makeResponse([makeItem()], { total: 3, page: 1, perPage: 20, unreadCount: 1 }),
      )
      .mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("3件")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "未読" }));

    expect(screen.getByRole("button", { name: "未読" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("6月練習のご案内").closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText("3件")).not.toBeInTheDocument();
    expect(screen.queryByText("未読の通知はありません")).not.toBeInTheDocument();
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
  });

  it("前のタブが0件でも、切り替えた直後に新しいタブの空状態を出さない", async () => {
    vi.mocked(notificationsApi.list)
      .mockResolvedValueOnce(makeResponse([]))
      .mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("通知はありません")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "未読" }));

    expect(screen.queryByText("未読の通知はありません")).not.toBeInTheDocument();
    expect(screen.queryByText("通知はありません")).not.toBeInTheDocument();
  });
});
