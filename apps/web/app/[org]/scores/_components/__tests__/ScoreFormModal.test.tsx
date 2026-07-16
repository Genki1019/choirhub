import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreFormModal } from "../ScoreFormModal";
import { scoresApi, type ConcertWithScores, type ScoreDetail } from "@/lib/scores-api";
import { concertsApi } from "@/lib/concerts-api";

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return {
    ...actual,
    scoresApi: {
      create: vi.fn(),
      updateMeta: vi.fn(),
    },
  };
});

vi.mock("@/lib/concerts-api", () => ({
  concertsApi: {
    addProgram: vi.fn(),
  },
}));

const existingScores = [{ title: "既存曲", composer: "既存作曲者" }];

const concertsSingleStage: ConcertWithScores[] = [
  {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    venue: null,
    stages: [{ id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [] }],
  },
];

const concertsMultiStage: ConcertWithScores[] = [
  {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    venue: null,
    stages: [
      { id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [] },
      { id: "stage-2", name: "第2ステージ", sortOrder: 1, programs: [] },
    ],
  },
];

function makeScoreDetail(overrides: Partial<ScoreDetail> = {}): ScoreDetail {
  return {
    id: "score-1",
    title: "既存の曲",
    composer: "既存作曲者",
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

describe("ScoreFormModal（追加モード・バリデーション）", () => {
  it("曲名が空白のみの場合はエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={existingScores}
        concerts={[]}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "   ");
    await user.click(screen.getByText("追加する"));
    expect(await screen.findByText("曲名を入力してください")).toBeInTheDocument();
  });

  it("同じ曲名・作曲者の楽譜が既に存在する場合、blur時に警告バナーを表示する", async () => {
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={existingScores}
        concerts={[]}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "既存曲");
    await user.type(screen.getByPlaceholderText("例: 山田 花子"), "既存作曲者");
    await user.tab();

    expect(
      await screen.findByText("同じ曲名・作曲者の楽譜が既に登録されています"),
    ).toBeInTheDocument();
  });

  it("警告表示中に曲名を変更すると警告がリセットされる", async () => {
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={existingScores}
        concerts={[]}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    const titleInput = screen.getByPlaceholderText("例: 男声合唱のための「風と光」");
    await user.type(titleInput, "既存曲");
    await user.type(screen.getByPlaceholderText("例: 山田 花子"), "既存作曲者");
    await user.tab();
    expect(
      await screen.findByText("同じ曲名・作曲者の楽譜が既に登録されています"),
    ).toBeInTheDocument();

    await user.type(titleInput, "改題");
    expect(
      screen.queryByText("同じ曲名・作曲者の楽譜が既に登録されています"),
    ).not.toBeInTheDocument();
  });

  it("「それでも追加する」で警告を解除して送信できる", async () => {
    vi.mocked(scoresApi.create).mockResolvedValue({
      id: "score-new",
      title: "既存曲",
      composer: "既存作曲者",
      arranger: null,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={existingScores}
        concerts={[]}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "既存曲");
    await user.type(screen.getByPlaceholderText("例: 山田 花子"), "既存作曲者");
    await user.tab();
    await user.click(await screen.findByText("それでも追加する"));
    await user.click(screen.getByText("追加する"));

    expect(onCreated).toHaveBeenCalledWith(
      { id: "score-new", title: "既存曲", composer: "既存作曲者", arranger: null },
      false,
    );
  });
});

describe("ScoreFormModal（追加モード・ステージ選択）", () => {
  it("ステージが複数ある演奏会を選択し未選択のままだと送信ボタンが無効になる", async () => {
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={[]}
        concerts={concertsMultiStage}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "新曲");
    await user.selectOptions(screen.getByDisplayValue("演奏会未定"), "第20回定期演奏会");

    expect(screen.getByText("追加する")).toBeDisabled();
  });

  it("ステージが1つの演奏会を選択すると自動的にそのステージが選択され送信できる", async () => {
    vi.mocked(scoresApi.create).mockResolvedValue({
      id: "score-new",
      title: "新曲",
      composer: null,
      arranger: null,
    });
    vi.mocked(concertsApi.addProgram).mockResolvedValue({} as never);
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={[]}
        concerts={concertsSingleStage}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "新曲");
    await user.selectOptions(screen.getByDisplayValue("演奏会未定"), "第20回定期演奏会");
    await user.click(screen.getByText("追加する"));

    expect(concertsApi.addProgram).toHaveBeenCalledWith("o", "concert-1", "stage-1", {
      scoreId: "score-new",
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "score-new" }), true);
  });

  it("演奏会未定のまま送信するとステージへの割り当てなしで作成される", async () => {
    vi.mocked(scoresApi.create).mockResolvedValue({
      id: "score-new",
      title: "新曲",
      composer: null,
      arranger: null,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={[]}
        concerts={concertsSingleStage}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "新曲");
    await user.click(screen.getByText("追加する"));

    expect(concertsApi.addProgram).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "score-new" }), false);
  });
});

describe("ScoreFormModal（編集モード）", () => {
  it("非adminの場合は曲名・作曲者・編曲者フィールドを表示しない", () => {
    render(
      <ScoreFormModal
        mode="edit"
        orgSlug="o"
        score={makeScoreDetail()}
        isAdmin={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByPlaceholderText("例: 男声合唱のための「風と光」")).not.toBeInTheDocument();
    expect(screen.getByText("楽譜情報を編集")).toBeInTheDocument();
  });

  it("adminの場合は曲名・作曲者・編曲者フィールドを表示し、送信時にpayloadへ含める", async () => {
    vi.mocked(scoresApi.updateMeta).mockResolvedValue({
      id: "score-1",
      title: "改題後",
      composer: "既存作曲者",
      arranger: null,
      accessLevel: "restricted",
      isCommissioned: false,
      purchaseDate: null,
      distributionStart: null,
      purchasePrice: null,
      notes: null,
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="edit"
        orgSlug="o"
        score={makeScoreDetail()}
        isAdmin={true}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    const titleInput = screen.getByDisplayValue("既存の曲");
    await user.clear(titleInput);
    await user.type(titleInput, "改題後");
    await user.click(screen.getByText("保存"));

    expect(scoresApi.updateMeta).toHaveBeenCalledWith(
      "o",
      "score-1",
      expect.objectContaining({ title: "改題後", composer: "既存作曲者", arranger: null }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("非adminの場合、送信時のpayloadにtitle/composer/arrangerを含めない", async () => {
    vi.mocked(scoresApi.updateMeta).mockResolvedValue({
      id: "score-1",
      title: "既存の曲",
      composer: "既存作曲者",
      arranger: null,
      accessLevel: "restricted",
      isCommissioned: false,
      purchaseDate: null,
      distributionStart: null,
      purchasePrice: null,
      notes: null,
    });
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="edit"
        orgSlug="o"
        score={makeScoreDetail()}
        isAdmin={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByText("保存"));

    const payload = vi.mocked(scoresApi.updateMeta).mock.calls[0][2];
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("composer");
    expect(payload).not.toHaveProperty("arranger");
  });
});

describe("ScoreFormModal（共通操作）", () => {
  it("閉じるボタン・キャンセルボタン・Escapeキーでモーダルを閉じる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoreFormModal
        mode="add"
        orgSlug="o"
        existingScores={[]}
        concerts={[]}
        onClose={onClose}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
