import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationBell from "../NotificationBell";
import { notificationsApi, type NotificationListResponse } from "@/lib/notifications-api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
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

function makeResponse(overrides: Partial<NotificationListResponse> = {}): NotificationListResponse {
  return {
    data: [],
    meta: { total: 0, page: 1, perPage: 8, unreadCount: 0 },
    ...overrides,
  };
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell org="tokyo-men-choir" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("NotificationBell（未読バッジ）", () => {
  it("未読が0件の場合はバッジを表示しない", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse());
    renderBell();

    await waitFor(() => expect(notificationsApi.list).toHaveBeenCalled());
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("未読件数を表示する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse({ meta: { total: 3, page: 1, perPage: 8, unreadCount: 3 } }),
    );
    renderBell();

    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("未読が10件以上は9+と表示する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse({ meta: { total: 12, page: 1, perPage: 8, unreadCount: 12 } }),
    );
    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });
});

describe("NotificationBell（開閉・一覧）", () => {
  it("初期状態ではドロップダウンを表示しない", () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse());
    renderBell();

    expect(screen.queryByText("通知はありません")).not.toBeInTheDocument();
  });

  it("ベルクリックでドロップダウンが開き、通知が0件なら空状態を表示する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByLabelText("通知"));
    expect(await screen.findByText("通知はありません")).toBeInTheDocument();
  });

  it("既読/未読で見た目が区別される", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse({
        data: [
          {
            id: "notif-1",
            type: "mailing_received",
            title: "未読の通知",
            body: null,
            link: "/mailing/mail-1",
            readAt: null,
            createdAt: new Date().toISOString(),
          },
          {
            id: "notif-2",
            type: "mailing_received",
            title: "既読の通知",
            body: null,
            link: "/mailing/mail-2",
            readAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { total: 2, page: 1, perPage: 8, unreadCount: 1 },
      }),
    );
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByLabelText("通知"));
    const unread = await screen.findByText("未読の通知");
    const read = screen.getByText("既読の通知");
    expect(unread.className).toContain("font-semibold");
    expect(read.className).not.toContain("font-semibold");
  });

  it("通知クリックで既読化し、リンク先へ遷移する", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse({
        data: [
          {
            id: "notif-1",
            type: "mailing_received",
            title: "未読の通知",
            body: null,
            link: "/mailing/mail-1",
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { total: 1, page: 1, perPage: 8, unreadCount: 1 },
      }),
    );
    vi.mocked(notificationsApi.markRead).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByLabelText("通知"));
    await user.click(await screen.findByText("未読の通知"));

    expect(notificationsApi.markRead).toHaveBeenCalledWith("tokyo-men-choir", "notif-1");
    expect(push).toHaveBeenCalledWith("/tokyo-men-choir/mailing/mail-1");
  });

  it("「すべて既読にする」クリックでmarkAllReadが呼ばれる", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(
      makeResponse({ meta: { total: 1, page: 1, perPage: 8, unreadCount: 1 } }),
    );
    vi.mocked(notificationsApi.markAllRead).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByLabelText("通知"));
    await user.click(await screen.findByText("すべて既読にする"));

    expect(notificationsApi.markAllRead).toHaveBeenCalledWith("tokyo-men-choir");
  });

  it("メニュー外クリックで閉じる", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <div>
          <NotificationBell org="tokyo-men-choir" />
          <button>外側</button>
        </div>
      </QueryClientProvider>,
    );

    await user.click(screen.getByLabelText("通知"));
    expect(await screen.findByText("通知はありません")).toBeInTheDocument();

    await user.click(screen.getByText("外側"));
    expect(screen.queryByText("通知はありません")).not.toBeInTheDocument();
  });
});
