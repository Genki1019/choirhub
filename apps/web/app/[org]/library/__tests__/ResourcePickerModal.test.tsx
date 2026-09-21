import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourcePickerModal } from "../_components/ResourcePickerModal";
import { scoresApi } from "@/lib/scores-api";
import { concertsApi } from "@/lib/concerts-api";
import { eventsApi } from "@/lib/events-api";

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return { ...actual, scoresApi: { list: vi.fn() } };
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ResourcePickerModal（楽譜）", () => {
  it("初期表示でscoresApi.listが空文字検索で呼ばれ、結果を選択するとonSelectが呼ばれる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: "作曲者A", arranger: null },
    ]);
    const user = userEvent.setup();
    const { onSelect } = renderModal("score");

    await waitFor(() => expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "" }));
    await user.click(await screen.findByText("楽譜A"));

    expect(onSelect).toHaveBeenCalledWith({ id: "score-1", title: "楽譜A" });
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

describe("ResourcePickerModal（閉じる）", () => {
  it("×ボタンでonCloseが呼ばれる", async () => {
    vi.mocked(scoresApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    const { onClose } = renderModal("score");

    await user.click(screen.getByLabelText("閉じる"));

    expect(onClose).toHaveBeenCalled();
  });
});
