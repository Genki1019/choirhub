import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyTab } from "../SurveyTab";
import {
  concertsApi,
  type ConcertDetail,
  type SurveyDetail,
  type SurveySummary,
} from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";

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

  it("保存中のセルが複数あっても、それぞれ保存が終わるまで押せない", async () => {
    const resolvers: (() => void)[] = [];
    vi.mocked(concertsApi.respondSurvey).mockImplementation(
      () => new Promise((resolve) => resolvers.push(() => resolve({ ok: true }))),
    );
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    const row = (await screen.findByText("山田太郎")).closest("div.grid") as HTMLElement;
    const [cell1, cell2] = within(row).getAllByRole("button");
    await user.click(cell1);
    await user.click(cell2);

    expect(cell1).toBeDisabled();
    expect(cell2).toBeDisabled();
    resolvers[1]();
    await waitFor(() => expect(cell2).toBeEnabled());
    expect(cell1).toBeDisabled();
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

describe("SurveyTab（失敗の表示）", () => {
  it("別の調査の読み込みに失敗したら、前の調査の回答を消してエラーを表示する", async () => {
    vi.mocked(concertsApi.getSurveyDetail).mockImplementation((_org, _concertId, surveyId) =>
      surveyId === "survey-2"
        ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve(makeSurveyDetail()),
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "調査の読み込みに失敗しました。ページを再読み込みしてください。",
    );
    expect(screen.queryByText("山田太郎")).not.toBeInTheDocument();
  });

  it("回答セルの保存に失敗したら元の回答に戻してエラーを表示する", async () => {
    vi.mocked(concertsApi.respondSurvey).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    const row = (await screen.findByText("山田太郎")).closest("div.grid") as HTMLElement;
    await user.click(within(row).getByTitle("参加"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "回答の保存に失敗しました。元の回答に戻しました。",
    );
    expect(within(row).getByTitle("参加")).toBeInTheDocument();
  });

  it("メモの保存に失敗したらエラーを表示し、入力したメモは残す", async () => {
    vi.mocked(concertsApi.respondSurvey).mockRejectedValue(
      new ApiClientError("SURVEY_CLOSED", "この調査は締め切られています", 403),
    );
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps()} />);

    const memoInputs = await screen.findAllByPlaceholderText("メモ");
    await user.type(memoInputs[0], "遅刻します");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent("この調査は締め切られています");
    expect(memoInputs[0]).toHaveValue("遅刻します");
  });

  it("確定・再開に失敗したらエラーを表示する", async () => {
    vi.mocked(concertsApi.patchSurvey).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<SurveyTab concert={makeConcert()} {...defaultProps({ canManageStage: true })} />);

    await user.click(await screen.findByRole("button", { name: "確定する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "調査の受付状態の変更に失敗しました。もう一度お試しください。",
    );
  });

  it("フォーメーションへの反映に失敗したらエラーを表示する", async () => {
    vi.mocked(concertsApi.applySurveyToFormation).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const user = userEvent.setup();
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2] })}
        {...defaultProps({ canManageStage: true })}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "フォーメーションに反映" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "フォーメーションへの反映に失敗しました。もう一度お試しください。",
    );
  });

  it("別の調査に切り替えるとエラーを消す", async () => {
    vi.mocked(concertsApi.patchSurvey).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2] })}
        {...defaultProps({ canManageStage: true })}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "確定する" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /二次調査/ }));

    await screen.findByText("山田太郎");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("調査を切り替えたあとに届いた前の調査の保存失敗は、新しい調査の画面に出さない", async () => {
    let rejectMemo: (err: unknown) => void = () => {};
    vi.mocked(concertsApi.respondSurvey).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMemo = reject;
      }),
    );
    vi.mocked(concertsApi.getSurveyDetail).mockImplementation((_org, _concertId, surveyId) =>
      Promise.resolve(
        makeSurveyDetail({
          id: surveyId,
          title: surveyId === "survey-2" ? "二次調査" : "一次調査",
          isOpen: surveyId !== "survey-2",
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

    const memoInputs = await screen.findAllByPlaceholderText("メモ");
    await user.type(memoInputs[0], "遅刻します");
    await user.click(screen.getByRole("button", { name: /二次調査/ }));
    await screen.findByRole("heading", { name: "二次調査" });
    rejectMemo(new TypeError("Failed to fetch"));

    await waitFor(() => expect(screen.getByRole("button", { name: "再開する" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("調査を切り替えたあとに届いた前の調査の確定結果で、新しい調査の受付状態を書き換えない", async () => {
    let resolveToggle: (v: Awaited<ReturnType<typeof concertsApi.patchSurvey>>) => void = () => {};
    vi.mocked(concertsApi.patchSurvey).mockReturnValue(
      new Promise((resolve) => {
        resolveToggle = resolve;
      }),
    );
    vi.mocked(concertsApi.getSurveyDetail).mockImplementation((_org, _concertId, surveyId) =>
      Promise.resolve(
        makeSurveyDetail({
          id: surveyId,
          title: surveyId === "survey-2" ? "二次調査" : "一次調査",
          isOpen: true,
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

    await user.click(await screen.findByRole("button", { name: "確定する" }));
    await user.click(screen.getByRole("button", { name: /二次調査/ }));
    await screen.findByRole("heading", { name: "二次調査" });
    resolveToggle({ id: "survey-1", title: "一次調査", isOpen: false, concertStatus: "confirmed" });

    await waitFor(() => expect(screen.getByRole("button", { name: "確定する" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "再開する" })).not.toBeInTheDocument();
  });

  it("調査を A→B→A と素早く切り替えたら、A の取得が終わるまで読み込み中にする", async () => {
    let resolveB: (d: SurveyDetail) => void = () => {};
    let secondA: (d: SurveyDetail) => void = () => {};
    let aCalls = 0;
    vi.mocked(concertsApi.getSurveyDetail).mockImplementation((_org, _concertId, surveyId) => {
      if (surveyId === "survey-2") return new Promise((r) => (resolveB = r));
      aCalls += 1;
      return aCalls === 1 ? Promise.resolve(makeSurveyDetail()) : new Promise((r) => (secondA = r));
    });
    const user = userEvent.setup();
    render(
      <SurveyTab
        concert={makeConcert({ surveys: [survey1, survey2] })}
        {...defaultProps({ canManageStage: true })}
      />,
    );

    await screen.findByText("山田太郎");
    await user.click(screen.getByRole("button", { name: /二次調査/ }));
    await user.click(screen.getByRole("button", { name: /一次調査/ }));

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("メモ")).not.toBeInTheDocument();
    resolveB(makeSurveyDetail({ id: "survey-2", title: "二次調査" }));
    secondA(makeSurveyDetail());
    expect(await screen.findByRole("heading", { name: "一次調査" })).toBeInTheDocument();
  });
});
