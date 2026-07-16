import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScheduleDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import type { EventDetail } from "@/lib/events-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "event-1" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/events-api", () => ({
  eventsApi: {
    get: vi.fn(),
    delete: vi.fn(),
    updateAttendance: vi.fn(),
  },
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    list: vi.fn(),
    parts: vi.fn(),
  },
}));

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "event-1",
    title: "第12回定期練習",
    category: { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
    startsAt: "2026-07-20T18:30:00+09:00",
    endsAt: "2026-07-20T21:00:00+09:00",
    location: "○○公民館",
    locationUrl: null,
    deadline: null,
    pageMemo: null,
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

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <ScheduleDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.list).mockResolvedValue([]);
  vi.mocked(membersApi.parts).mockResolvedValue([]);
});

describe("ScheduleDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(eventsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はヘッダーとエラーメッセージを表示する", async () => {
    vi.mocked(eventsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("イベント詳細")).toBeInTheDocument();
    expect(screen.getByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("タイトル・日時・場所を表示する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    renderPage();

    expect(await screen.findByText("第12回定期練習")).toBeInTheDocument();
    expect(screen.getByText(/7\/20（月）18:30〜21:00/)).toBeInTheDocument();
    expect(screen.getByText("○○公民館")).toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（バッジ表示）", () => {
  it("isLocked=trueの場合: 「締切済み」バッジを表示し「回答済み」は出さない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        isLocked: true,
        attendances: [
          {
            member: { id: "member-self", nameJa: "自分", part: null },
            status: "attending",
            arriveTime: null,
            leaveTime: null,
            dayMemo: null,
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("締切済み")).toBeInTheDocument();
    expect(screen.queryByText("回答済み")).not.toBeInTheDocument();
  });

  it("isLocked=falseかつ自分が回答済みの場合: 「回答済み」バッジを表示する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        isLocked: false,
        attendances: [
          {
            member: { id: "member-self", nameJa: "自分", part: null },
            status: "attending",
            arriveTime: null,
            leaveTime: null,
            dayMemo: null,
          },
        ],
      }),
    );
    vi.mocked(membersApi.list).mockResolvedValue([
      { id: "member-self", nameJa: "自分", part: null } as never,
    ]);
    renderPage();

    expect(await screen.findByText("回答済み")).toBeInTheDocument();
    expect(screen.queryByText("締切済み")).not.toBeInTheDocument();
  });

  it("自分が未回答の場合: 「回答済み」バッジを表示しない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(membersApi.list).mockResolvedValue([
      { id: "member-self", nameJa: "自分", part: null } as never,
    ]);
    renderPage();

    await screen.findByText("第12回定期練習");
    expect(screen.queryByText("回答済み")).not.toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（編集・削除ボタンの権限）", () => {
  it.each([["admin"], ["tech"], ["conductor"]])(
    "%sロール: 「編集」「削除」ボタンを表示する",
    async (role) => {
      vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
      renderPage([role]);

      expect(await screen.findByText("編集")).toBeInTheDocument();
      expect(screen.getByText("削除")).toBeInTheDocument();
    },
  );

  it("member: 「編集」「削除」ボタンを表示しない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    renderPage(["member"]);

    await screen.findByText("第12回定期練習");
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
    expect(screen.queryByText("削除")).not.toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（全体備考）", () => {
  it("pageMemoが無い場合: 全体備考セクションを表示しない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ pageMemo: null }));
    renderPage();

    await screen.findByText("第12回定期練習");
    expect(screen.queryByText("全体備考")).not.toBeInTheDocument();
  });

  it("pageMemoがある場合: 全体備考セクションを表示する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ pageMemo: "楽譜をご持参ください" }));
    renderPage();

    expect(await screen.findByText("全体備考")).toBeInTheDocument();
    expect(screen.getByText("楽譜をご持参ください")).toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（場所リンク）", () => {
  it("locationUrlが無い場合: Googleマップ検索URLにフォールバックする", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({ location: "○○公民館", locationUrl: null }),
    );
    renderPage();

    const link = await screen.findByText("○○公民館");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=%E2%97%8B%E2%97%8B%E5%85%AC%E6%B0%91%E9%A4%A8",
    );
  });

  it("locationUrlがある場合: そのURLを使う", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        location: "○○公民館",
        locationUrl: "https://maps.example.com/xyz",
      }),
    );
    renderPage();

    const link = await screen.findByText("○○公民館");
    expect(link.closest("a")).toHaveAttribute("href", "https://maps.example.com/xyz");
  });
});

// ────────────────────────────
// 出欠回答フロー
// ────────────────────────────

const selfMember = {
  id: "member-self",
  nameJa: "自分",
  part: { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
} as never;

const otherMember = {
  id: "member-other",
  nameJa: "他人",
  part: { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
} as never;

function setupAttendanceMembers() {
  vi.mocked(membersApi.list).mockResolvedValue([selfMember, otherMember]);
  vi.mocked(membersApi.parts).mockResolvedValue([
    { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
  ]);
}

describe("ScheduleDetailPage（出欠セルのクリック）", () => {
  it("自分の行のセルをクリックすると即座に表示が更新され、updateAttendanceが呼ばれる", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(eventsApi.updateAttendance).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderPage();

    const cell = await screen.findByTitle("クリックで変更");
    expect(cell).toHaveTextContent("—");

    await user.click(cell);
    expect(cell).toHaveTextContent("○");
    expect(eventsApi.updateAttendance).toHaveBeenCalledWith("tokyo-men-choir", "event-1", {
      status: "attending",
      arriveTime: null,
      leaveTime: null,
      dayMemo: null,
    });

    await user.click(cell);
    expect(cell).toHaveTextContent("✕");

    await user.click(cell);
    expect(cell).toHaveTextContent("△");

    await user.click(cell);
    expect(cell).toHaveTextContent("—");
  });

  it("自分以外の行のセルはクリックできない", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("他人");
    const otherRow = screen.getByText("他人").closest(".border-b")!;
    const otherCell = within(otherRow as HTMLElement).getByRole("button");
    expect(otherCell).toBeDisabled();

    await user.click(otherCell);
    expect(eventsApi.updateAttendance).not.toHaveBeenCalled();
  });

  it("isLocked=trueの場合、自分の行でもクリックできない", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: true, attendances: [] }));
    renderPage();

    await screen.findByText("自分");
    const selfRow = screen.getByText("自分").closest(".border-b")!;
    const cell = within(selfRow as HTMLElement).getByRole("button");
    expect(cell).toBeDisabled();
  });

  it("maybeへ切り替えるとメモ入力欄が展開される", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(eventsApi.updateAttendance).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderPage();

    const cell = await screen.findByTitle("クリックで変更");
    await user.click(cell); // attending
    await user.click(cell); // absent
    await user.click(cell); // maybe

    expect(await screen.findByText("△ 詳細を入力してください")).toBeInTheDocument();
  });

  it("ステータス更新API失敗時は元の状態にロールバックする", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(eventsApi.updateAttendance).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderPage();

    const cell = await screen.findByTitle("クリックで変更");
    await user.click(cell);

    await waitFor(() => {
      expect(cell).toHaveTextContent("—");
    });
  });
});

describe("ScheduleDetailPage（メモ保存）", () => {
  async function openMemoRow(user: ReturnType<typeof userEvent.setup>) {
    const cell = await screen.findByTitle("クリックで変更");
    await user.click(cell); // attending
    await user.click(cell); // absent
    await user.click(cell); // maybe
    await screen.findByText("△ 詳細を入力してください");
  }

  it("「保存」クリックでupdateAttendanceが呼ばれ、成功時は入力欄が閉じる", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(eventsApi.updateAttendance).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderPage();

    await openMemoRow(user);
    await user.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(eventsApi.updateAttendance).toHaveBeenLastCalledWith(
        "tokyo-men-choir",
        "event-1",
        expect.objectContaining({ status: "maybe" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("△ 詳細を入力してください")).not.toBeInTheDocument();
    });
  });

  it("メモ保存API失敗時は元の状態にロールバックする", async () => {
    setupAttendanceMembers();
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(eventsApi.updateAttendance)
      .mockResolvedValueOnce(undefined as never) // attending
      .mockResolvedValueOnce(undefined as never) // absent
      .mockResolvedValueOnce(undefined as never) // maybe
      .mockRejectedValueOnce(new Error("failed")); // メモ保存
    const user = userEvent.setup();
    renderPage();

    await openMemoRow(user);
    await user.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(screen.getByTitle("未回答")).toBeInTheDocument();
    });
  });
});

describe("ScheduleDetailPage（削除フロー）", () => {
  it("「削除」→確認モーダル表示→「キャンセル」で閉じる", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    expect(screen.getByText("イベントを削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
    expect(screen.queryByText("イベントを削除しますか？")).not.toBeInTheDocument();
    expect(eventsApi.delete).not.toHaveBeenCalled();
  });

  it("確認モーダルで「削除する」→削除成功時は一覧へ遷移する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    vi.mocked(eventsApi.delete).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    await user.click(screen.getByText("削除する"));

    await waitFor(() => {
      expect(eventsApi.delete).toHaveBeenCalledWith("tokyo-men-choir", "event-1");
    });
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/schedule");
  });

  it("削除失敗時はエラーメッセージを表示し、モーダルは開いたままになる", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    vi.mocked(eventsApi.delete).mockRejectedValue(new Error("削除に失敗しました"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    await user.click(screen.getByText("削除する"));

    expect(await screen.findByText("削除に失敗しました")).toBeInTheDocument();
    expect(screen.getByText("イベントを削除しますか？")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
