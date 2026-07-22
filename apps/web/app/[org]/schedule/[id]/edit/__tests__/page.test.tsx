import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EditSchedulePage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";
import type { EventDetail } from "@/lib/events-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "event-1" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/events-api", () => ({
  eventsApi: {
    get: vi.fn(),
    update: vi.fn(),
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

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "event-1",
    title: "第12回定期練習",
    category: categories[0],
    startsAt: "2026-07-20T18:30:00+09:00",
    endsAt: "2026-07-20T21:00:00+09:00",
    location: "○○公民館",
    locationUrl: null,
    deadline: null,
    rehearsalContent: null,
    timeSchedule: null,
    practiceVenue: null,
    otherNotes: null,
    isLocked: false,
    targetRoles: null,
    targetPartIds: null,
    concertId: null,
    invitedCount: 1,
    attendances: [],
    summary: { attending: 0, absent: 0, maybe: 0, undecided: 1 },
    ...overrides,
  };
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <EditSchedulePage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([]);
  vi.mocked(settingsApi.listEventCategories).mockResolvedValue(categories);
  vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
});

describe("EditSchedulePage（権限・表示状態）", () => {
  it.each([["member"], ["guest"], ["score"]])(
    "%sロール: アクセス権限がありませんと表示する",
    (role) => {
      renderPage([role]);
      expect(screen.getByText("このページにアクセスする権限がありません")).toBeInTheDocument();
    },
  );

  it("admin: ローディング中は「読み込み中...」を表示する", () => {
    vi.mocked(eventsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage(["admin"]);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("初期化エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(eventsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage(["admin"]);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });
});

describe("EditSchedulePage（フォームの初期化）", () => {
  it("取得したイベントデータでフォームが初期化される", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        title: "第13回定期練習",
        category: categories[1],
        location: "△△公民館",
      }),
    );
    renderPage(["admin"]);

    expect(await screen.findByDisplayValue("第13回定期練習")).toBeInTheDocument();
    expect(screen.getByText("本番")).toHaveClass("bg-brand-600");
    expect(screen.getByDisplayValue("△△公民館")).toBeInTheDocument();
    expect(screen.getByLabelText("開始日")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("開始時刻")).toHaveValue("18:30");
  });

  it("deadlineが無いイベントの場合: 締切トグルOFFで初期化される", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ deadline: null }));
    renderPage(["admin"]);

    await screen.findByDisplayValue("第12回定期練習");
    expect(screen.getByLabelText("出欠締切を設定する")).toHaveAttribute("aria-checked", "false");
  });

  it("deadlineがあるイベントの場合: 締切トグルONで初期化され日時も反映される", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({ deadline: "2026-07-18T23:59:00+09:00" }),
    );
    renderPage(["admin"]);

    await screen.findByDisplayValue("第12回定期練習");
    expect(screen.getByLabelText("出欠締切を設定する")).toHaveAttribute("aria-checked", "true");
  });

  it("構造化備考フィールドが取得したイベントデータで初期化される", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        rehearsalContent: "新曲『○○』の初見合わせ",
        timeSchedule: "18:00 集合 / 18:15 発声",
        practiceVenue: "3階 大会議室",
        otherNotes: "個人ボイトレ希望者は事前連絡",
      }),
    );
    renderPage(["admin"]);

    expect(await screen.findByDisplayValue("新曲『○○』の初見合わせ")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18:00 集合 / 18:15 発声")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3階 大会議室")).toBeInTheDocument();
    expect(screen.getByDisplayValue("個人ボイトレ希望者は事前連絡")).toBeInTheDocument();
  });
});

describe("EditSchedulePage（バリデーション）", () => {
  it("タイトルを空にして送信: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    renderPage(["admin"]);

    const titleInput = await screen.findByDisplayValue("第12回定期練習");
    await user.clear(titleInput);
    await user.click(screen.getByText("保存する"));

    expect(await screen.findByText("タイトルを入力してください。")).toBeInTheDocument();
    expect(eventsApi.update).not.toHaveBeenCalled();
  });
});

describe("EditSchedulePage（送信）", () => {
  it("送信成功: eventsApi.updateが正しいペイロードで呼ばれ詳細ページへ遷移する", async () => {
    vi.mocked(eventsApi.update).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPage(["admin"]);

    const titleInput = await screen.findByDisplayValue("第12回定期練習");
    await user.clear(titleInput);
    await user.type(titleInput, "第12回定期練習（変更後）");
    await user.click(screen.getByText("保存する"));

    await waitFor(() => {
      expect(eventsApi.update).toHaveBeenCalledWith(
        "tokyo-men-choir",
        "event-1",
        expect.objectContaining({ title: "第12回定期練習（変更後）" }),
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/schedule/event-1");
  });

  it("構造化備考フィールドを入力して送信: eventsApi.updateに反映される", async () => {
    vi.mocked(eventsApi.update).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByDisplayValue("第12回定期練習");
    await user.type(screen.getByPlaceholderText(/新曲『○○』の初見合わせ/), "新曲の初見合わせ");
    await user.type(screen.getByPlaceholderText(/集合 \/ 18:15 発声/), "18:00 集合");
    await user.type(screen.getByPlaceholderText(/3階 大会議室/), "2階 練習室");
    await user.type(screen.getByPlaceholderText(/個人ボイトレ希望者/), "楽譜を持参してください");
    await user.click(screen.getByText("保存する"));

    await waitFor(() => {
      expect(eventsApi.update).toHaveBeenCalledWith(
        "tokyo-men-choir",
        "event-1",
        expect.objectContaining({
          rehearsalContent: "新曲の初見合わせ",
          timeSchedule: "18:00 集合",
          practiceVenue: "2階 練習室",
          otherNotes: "楽譜を持参してください",
        }),
      );
    });
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(eventsApi.update).mockRejectedValue(new Error("保存に失敗しました。"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByDisplayValue("第12回定期練習");
    await user.click(screen.getByText("保存する"));

    expect(await screen.findByText("保存に失敗しました。")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
