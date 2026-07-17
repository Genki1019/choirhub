import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyTab } from "../SurveyTab";
import {
  concertsApi,
  type ConcertDetail,
  type SurveyDetail,
  type SurveySummary,
} from "@/lib/concerts-api";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      getSurveyDetail: vi.fn(),
      respondSurvey: vi.fn(),
      patchSurvey: vi.fn(),
      applySurveyToFormation: vi.fn(),
    },
  };
});

const survey1: SurveySummary = {
  id: "survey-1",
  title: "一次調査",
  isOpen: true,
  openAt: "2026-08-01T00:00:00+09:00",
  closeAt: "2026-08-31T23:59:00+09:00",
  responseCount: 2,
};

const survey2: SurveySummary = {
  id: "survey-2",
  title: "二次調査",
  isOpen: false,
  openAt: "2026-08-01T00:00:00+09:00",
  closeAt: null,
  responseCount: 1,
};

function makeConcert(overrides: Partial<ConcertDetail> = {}): ConcertDetail {
  return {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    venue: null,
    status: "survey_open",
    linkedEventId: null,
    stages: [
      { id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [] },
      { id: "stage-2", name: "第2ステージ", sortOrder: 1, programs: [] },
    ],
    surveys: [survey1],
    appliedSurveyId: null,
    assignments: [],
    ...overrides,
  };
}

function makeSurveyDetail(overrides: Partial<SurveyDetail> = {}): SurveyDetail {
  return {
    id: "survey-1",
    title: "一次調査",
    isOpen: true,
    closeAt: "2026-08-31T23:59:00+09:00",
    rows: [
      {
        memberId: "member-self",
        nameJa: "山田太郎",
        partId: "p1",
        partName: "テノール1",
        partSortOrder: 1,
        partVoiceType: "tenor1",
        stages: [
          { stageId: "stage-1", status: "attending" },
          { stageId: "stage-2", status: "undecided" },
        ],
        memo: null,
      },
      {
        memberId: "member-2",
        nameJa: "田中次郎",
        partId: "p1",
        partName: "テノール1",
        partSortOrder: 1,
        partVoiceType: "tenor1",
        stages: [
          { stageId: "stage-1", status: "undecided" },
          { stageId: "stage-2", status: "undecided" },
        ],
        memo: "遅刻",
      },
    ],
    stageSummaries: [
      { stageId: "stage-1", summary: { attending: 1, absent: 0, undecided: 1 } },
      { stageId: "stage-2", summary: { attending: 0, absent: 0, undecided: 2 } },
    ],
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    org: "tokyo-men-choir",
    isAdmin: false,
    canManageStage: false,
    myMemberId: "member-self",
    onSurveysChanged: vi.fn(),
    onConcertStatusChanged: vi.fn(),
    onAssignmentsMayChange: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(concertsApi.getSurveyDetail).mockResolvedValue(makeSurveyDetail());
});

describe("SurveyTab（調査が0件の場合）", () => {
  it("案内メッセージを表示する", () => {
    render(<SurveyTab concert={makeConcert({ surveys: [] })} {...defaultProps()} />);
    expect(screen.getByText("オンステ調査はまだ開設されていません")).toBeInTheDocument();
  });

  it("canManageStageの場合のみ「調査を開設する」ボタンを表示する", () => {
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [] })}
        {...defaultProps({ canManageStage: true })}
      />,
    );
    expect(screen.getByText("調査を開設する")).toBeInTheDocument();
  });

  it("canManageStage: falseの場合はボタンを表示しない", () => {
    render(<SurveyTab concert={makeConcert({ surveys: [] })} {...defaultProps()} />);
    expect(screen.queryByText("調査を開設する")).not.toBeInTheDocument();
  });
});

describe("SurveyTab（マトリクス表示）", () => {
  it("読み込み中は「読み込み中...」を表示する", () => {
    vi.mocked(concertsApi.getSurveyDetail).mockReturnValue(new Promise(() => {}));
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("メンバー名・パート名・自分の行のハイライトを表示する", async () => {
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    expect(await screen.findByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("（自分）")).toBeInTheDocument();
    expect(screen.getByText("田中次郎")).toBeInTheDocument();
    expect(screen.getAllByText("テノール1").length).toBeGreaterThan(0);
  });

  it("ステータス集計行を表示する", async () => {
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);
    await screen.findByText("山田太郎");
    expect(screen.getByText("○ 1")).toBeInTheDocument();
    expect(screen.getByText("— 1")).toBeInTheDocument();
  });

  it("ステージが0件の場合はメッセージを表示する", async () => {
    render(<SurveyTab concert={makeConcert({ stages: [] })} {...defaultProps()} />);
    expect(await screen.findByText("ステージが登録されていません")).toBeInTheDocument();
  });
});

describe("SurveyTab（回答セルの操作）", () => {
  it("自分のセルをクリックするとステータスが循環しrespondSurveyが呼ばれる", async () => {
    vi.mocked(concertsApi.respondSurvey).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    const row = (await screen.findByText("山田太郎")).closest("div.grid") as HTMLElement;
    const attendingCell = within(row).getByTitle("参加");
    await user.click(attendingCell);

    expect(concertsApi.respondSurvey).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "concert-1",
      "survey-1",
      [{ stageId: "stage-1", status: "absent" }],
      undefined,
      undefined,
    );
  });

  it("他人のセルは自分がadminでない場合はクリックできない", async () => {
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    const row = (await screen.findByText("田中次郎")).closest("div.grid") as HTMLElement;
    const cell = within(row).getAllByTitle("未回答")[0];
    expect(cell).toBeDisabled();
    await user.click(cell);
    expect(concertsApi.respondSurvey).not.toHaveBeenCalled();
  });

  it("adminは他人のセルをtargetMemberId付きで編集できる", async () => {
    vi.mocked(concertsApi.respondSurvey).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps({ isAdmin: true })} />);

    const row = (await screen.findByText("田中次郎")).closest("div.grid") as HTMLElement;
    const cell = within(row).getAllByTitle("未回答")[0];
    await user.click(cell);

    expect(concertsApi.respondSurvey).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "concert-1",
      "survey-1",
      [{ stageId: "stage-1", status: "attending" }],
      undefined,
      "member-2",
    );
  });

  it("メモをフォーカスアウトすると全ステージの現在値と共にrespondSurveyが呼ばれる", async () => {
    vi.mocked(concertsApi.respondSurvey).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    const memoInputs = await screen.findAllByPlaceholderText("メモ");
    await user.type(memoInputs[0], "遅刻します");
    await user.tab();

    expect(concertsApi.respondSurvey).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "concert-1",
      "survey-1",
      [
        { stageId: "stage-1", status: "attending" },
        { stageId: "stage-2", status: "undecided" },
      ],
      "遅刻します",
      undefined,
    );
  });
});

describe("SurveyTab（調査の締切・再開）", () => {
  it("canManageStageの場合「確定する」ボタンを表示しクリックでpatchSurveyが呼ばれる", async () => {
    vi.mocked(concertsApi.patchSurvey).mockResolvedValue({
      id: "survey-1",
      title: "一次調査",
      isOpen: false,
      concertStatus: "confirmed",
    });
    const onConcertStatusChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <SurveyTab
        concert={makeConcert()}
        {...defaultProps({ canManageStage: true, onConcertStatusChanged })}
      />,
    );

    await user.click(await screen.findByText("確定する"));

    expect(concertsApi.patchSurvey).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "concert-1",
      "survey-1",
      { isOpen: false },
    );
    expect(onConcertStatusChanged).toHaveBeenCalledWith("confirmed");
  });

  it("canManageStage: falseの場合は「確定する」ボタンを表示しない", async () => {
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);
    await screen.findByText("山田太郎");
    expect(screen.queryByText("確定する")).not.toBeInTheDocument();
  });
});

describe("SurveyTab（複数調査・フォーメーション反映）", () => {
  it("調査が複数ある場合のみ「フォーメーションに反映」ボタンを表示する", async () => {
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2] })}
        {...defaultProps({ canManageStage: true })}
      />,
    );
    expect(await screen.findByText("フォーメーションに反映")).toBeInTheDocument();
  });

  it("「フォーメーションに反映」クリックでapplySurveyToFormationが呼ばれる", async () => {
    vi.mocked(concertsApi.applySurveyToFormation).mockResolvedValue({ ok: true });
    const onAssignmentsMayChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2] })}
        {...defaultProps({ canManageStage: true, onAssignmentsMayChange })}
      />,
    );

    await user.click(await screen.findByText("フォーメーションに反映"));

    expect(concertsApi.applySurveyToFormation).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "concert-1",
      "survey-1",
    );
    expect(onAssignmentsMayChange).toHaveBeenCalled();
  });

  it("appliedSurveyIdと一致する調査は「反映済み」と表示される", async () => {
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2], appliedSurveyId: "survey-1" })}
        {...defaultProps({ canManageStage: true })}
      />,
    );
    expect(await screen.findByText("反映済み")).toBeInTheDocument();
  });

  it("調査セレクタのチップクリックで別の調査に切り替わる", async () => {
    vi.mocked(concertsApi.getSurveyDetail).mockImplementation((_org, _concertId, surveyId) =>
      Promise.resolve(
        makeSurveyDetail({
          id: surveyId,
          title: surveyId === "survey-2" ? "二次調査" : "一次調査",
        }),
      ),
    );
    const user = userEvent.setup();
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2] })}
        {...defaultProps({ canManageStage: true })}
      />,
    );

    await screen.findByText("山田太郎");
    await user.click(screen.getByRole("button", { name: /二次調査/ }));

    expect(concertsApi.getSurveyDetail).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "concert-1",
      "survey-2",
    );
  });
});
