import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourcePickerModal } from "../_components/ResourcePickerModal";
import { scoresApi, type ScoreDetail } from "@/lib/scores-api";
import { ApiClientError } from "@/lib/api-client";
import { concertsApi } from "@/lib/concerts-api";
import { eventsApi } from "@/lib/events-api";

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return { ...actual, scoresApi: { list: vi.fn(), getDetail: vi.fn() } };
});

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return { ...actual, concertsApi: { list: vi.fn() } };
});

vi.mock("@/lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/events-api")>("@/lib/events-api");
  return { ...actual, eventsApi: { list: vi.fn() } };
});

function renderModal(kind: "score" | "concert" | "event", onSelect = vi.fn(), onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onSelect,
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ResourcePickerModal
          org="tokyo-men-choir"
          kind={kind}
          onClose={onClose}
          onSelect={onSelect}
        />
      </QueryClientProvider>,
    ),
  };
}

function makeScore(overrides: Partial<ScoreDetail> = {}): ScoreDetail {
  return {
    id: "score-1",
    title: "楽譜A",
    composer: "作曲者A",
    arranger: null,
    accessLevel: "restricted",
    distributionPrice: null,
    canAccessFiles: true,
    canDownload: true,
    files: [],
    isCommissioned: false,
    purchaseDate: null,
    distributionStart: null,
    notes: null,
    hasCollection: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ResourcePickerModal（楽譜）", () => {
  it("初期表示でscoresApi.listが空文字検索で呼ばれ、選ぶと楽譜の詳細を読み込んでからonSelectが呼ばれる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: "作曲者A", arranger: null },
    ]);
    const score = makeScore();
    vi.mocked(scoresApi.getDetail).mockResolvedValue(score);
    const user = userEvent.setup();
    const { onSelect } = renderModal("score");

    await waitFor(() => expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "" }));
    await user.click(await screen.findByText("楽譜A"));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({ id: "score-1", title: "楽譜A", score }),
    );
    expect(scoresApi.getDetail).toHaveBeenCalledWith("tokyo-men-choir", "score-1");
  });

  it("楽譜の読み込み中は、押した行に読み込み中の印を付け、まだ次へ進まない", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
    ]);
    vi.mocked(scoresApi.getDetail).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onSelect } = renderModal("score");

    await user.click(await screen.findByText("楽譜A"));

    expect(screen.getByRole("button", { name: /楽譜A/ })).toHaveAttribute("aria-busy", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("楽譜の読み込みに失敗したら、選択のモーダルに理由を出し、選び直せる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
    ]);
    vi.mocked(scoresApi.getDetail)
      .mockRejectedValueOnce(new ApiClientError("NOT_FOUND", "楽譜が見つかりません", 404))
      .mockResolvedValueOnce(makeScore());
    const user = userEvent.setup();
    const { onSelect } = renderModal("score");

    await user.click(await screen.findByText("楽譜A"));
    expect(await screen.findByRole("alert")).toHaveTextContent("楽譜が見つかりません");
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByText("楽譜A"));
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
  });

  it("読み込み中に別の楽譜を押すと、最後に押した楽譜で次へ進む", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
      { id: "score-2", title: "楽譜B", composer: null, arranger: null },
    ]);
    let resolveFirst: (s: ScoreDetail) => void = () => {};
    vi.mocked(scoresApi.getDetail).mockImplementation((_org, id) =>
      id === "score-1"
        ? new Promise((r) => (resolveFirst = r))
        : Promise.resolve(makeScore({ id: "score-2", title: "楽譜B" })),
    );
    const user = userEvent.setup();
    const { onSelect } = renderModal("score");

    await user.click(await screen.findByText("楽譜A"));
    await user.click(screen.getByText("楽譜B"));
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    resolveFirst(makeScore());
    await new Promise((r) => setTimeout(r, 0));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "score-2" }));
  });

  it("読み込み中に閉じたら、あとから届いた応答では次へ進まない", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
    ]);
    let resolveDetail: (s: ScoreDetail) => void = () => {};
    vi.mocked(scoresApi.getDetail).mockReturnValue(new Promise((r) => (resolveDetail = r)));
    const user = userEvent.setup();
    const { onSelect, unmount } = renderModal("score");

    await user.click(await screen.findByText("楽譜A"));
    unmount();
    resolveDetail(makeScore());
    await new Promise((r) => setTimeout(r, 0));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("検索文字を入力すると（デバウンス後に）その文字でscoresApi.listが呼ばれる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderModal("score");

    await waitFor(() => expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "" }));
    await user.type(screen.getByPlaceholderText("楽譜を検索..."), "田中");

    await waitFor(
      () => expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "田中" }),
      { timeout: 2000 },
    );
  });

  it("見つからない場合は「見つかりません」を表示する", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([]);
    renderModal("score");

    expect(await screen.findByText("見つかりません")).toBeInTheDocument();
  });
});

describe("ResourcePickerModal（一覧の取得失敗）", () => {
  it.each(["score", "concert", "event"] as const)(
    "%s: 一覧の取得に失敗したら「見つかりません」ではなく理由を出す",
    async (kind) => {
      const err = new ApiClientError("UNKNOWN", "", 500);
      vi.mocked(scoresApi.list).mockRejectedValue(err);
      vi.mocked(concertsApi.list).mockRejectedValue(err);
      vi.mocked(eventsApi.list).mockRejectedValue(err);
      renderModal(kind);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /の読み込みに失敗しました。もう一度お試しください。/,
      );
      expect(screen.queryByText("見つかりません")).not.toBeInTheDocument();
    },
  );

  it("4xxならAPIの理由を出す", async () => {
    vi.mocked(concertsApi.list).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "閲覧権限がありません", 403),
    );
    renderModal("concert");

    expect(await screen.findByRole("alert")).toHaveTextContent("閲覧権限がありません");
  });
});

describe("ResourcePickerModal（本番）", () => {
  it("全件取得しタイトルでクライアント側フィルタする", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: "2026-11-23",
        venue: null,
        status: "draft",
        stageCount: 1,
        programCount: 1,
        hasSurvey: false,
        surveyOpen: false,
        linkedEventId: null,
      },
      {
        id: "concert-2",
        title: "ジョイントコンサート",
        heldOn: "2026-12-01",
        venue: null,
        status: "draft",
        stageCount: 1,
        programCount: 1,
        hasSurvey: false,
        surveyOpen: false,
        linkedEventId: null,
      },
    ]);
    const user = userEvent.setup();
    renderModal("concert");

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("ジョイントコンサート")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("本番を検索..."), "ジョイント");

    expect(screen.queryByText("第20回定期演奏会")).not.toBeInTheDocument();
    expect(screen.getByText("ジョイントコンサート")).toBeInTheDocument();
    // クライアント側フィルタのため再フェッチは発生しない
    expect(concertsApi.list).toHaveBeenCalledTimes(1);
  });

  it("選択するとonSelectが呼ばれる", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: "2026-11-23",
        venue: null,
        status: "draft",
        stageCount: 1,
        programCount: 1,
        hasSurvey: false,
        surveyOpen: false,
        linkedEventId: null,
      },
    ]);
    const user = userEvent.setup();
    const { onSelect } = renderModal("concert");

    await user.click(await screen.findByText("第20回定期演奏会"));

    expect(onSelect).toHaveBeenCalledWith({ id: "concert-1", title: "第20回定期演奏会" });
  });
});

describe("ResourcePickerModal（イベント）", () => {
  it("全件取得しタイトルでクライアント側フィルタする", async () => {
    vi.mocked(eventsApi.list).mockResolvedValue([
      {
        id: "event-1",
        title: "第12回定期練習",
        category: { id: "c1", name: "練習", slug: null, color: "#000", sortOrder: 1 },
        startsAt: "2026-06-10T09:30:00Z",
        endsAt: "2026-06-10T12:00:00Z",
        location: null,
        locationUrl: null,
        deadline: null,
        rehearsalContent: null,
        timeSchedule: null,
        practiceVenue: null,
        otherNotes: null,
        isLocked: false,
        targetRoles: null,
        targetPartIds: null,
        myAttendance: "undecided",
        concertId: null,
      },
    ]);
    renderModal("event");

    expect(await screen.findByText("第12回定期練習")).toBeInTheDocument();
    expect(eventsApi.list).toHaveBeenCalledWith("tokyo-men-choir");
  });
});

describe("ResourcePickerModal（キーボード・読み上げ）", () => {
  it("開くと名前付きの検索欄にフォーカスが入る", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([]);
    renderModal("score");

    expect(screen.getByRole("dialog", { name: "楽譜を選択" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "楽譜を検索" })).toHaveFocus();
  });
});

describe("ResourcePickerModal（閉じる）", () => {
  it("×ボタン・EscでonCloseが呼ばれる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    const { onClose } = renderModal("score");

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("楽譜の読み込み中でも閉じられる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
    ]);
    vi.mocked(scoresApi.getDetail).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderModal("score");

    await user.click(await screen.findByText("楽譜A"));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});

describe("ResourcePickerModal（日付の表示）", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Los_Angeles");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("本番の開催日を、ブラウザのタイムゾーンによらず日本時間の日付で表示する", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([
      {
        id: "concert-1",
        title: "深夜公演",
        heldOn: "2026-11-22T15:30:00.000Z",
        venue: null,
        status: "draft",
        stageCount: 1,
        programCount: 1,
        hasSurvey: false,
        surveyOpen: false,
        linkedEventId: null,
      },
    ]);
    renderModal("concert");

    expect(await screen.findByText("2026年11月23日")).toBeInTheDocument();
    expect(screen.queryByText(/T15:30/)).not.toBeInTheDocument();
  });

  it("予定の開始日を、ブラウザのタイムゾーンによらず日本時間の日付で表示する", async () => {
    vi.mocked(eventsApi.list).mockResolvedValue([
      {
        id: "event-1",
        title: "早朝練習",
        category: { id: "c1", name: "練習", slug: null, color: "#000", sortOrder: 1 },
        startsAt: "2026-06-09T22:00:00Z",
        endsAt: "2026-06-10T00:00:00Z",
        location: null,
        locationUrl: null,
        deadline: null,
        rehearsalContent: null,
        timeSchedule: null,
        practiceVenue: null,
        otherNotes: null,
        isLocked: false,
        targetRoles: null,
        targetPartIds: null,
        myAttendance: "undecided",
        concertId: null,
      },
    ]);
    renderModal("event");

    expect(await screen.findByText("2026年6月10日")).toBeInTheDocument();
  });
});
