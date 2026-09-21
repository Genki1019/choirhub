import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScoreFilesModal } from "../_components/ScoreFilesModal";
import { MemberProvider } from "@/contexts/MemberContext";
import { scoresApi, type ScoreDetail } from "@/lib/scores-api";
import { membersApi } from "@/lib/members-api";

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return { ...actual, scoresApi: { getDetail: vi.fn() } };
});

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return { ...actual, membersApi: { parts: vi.fn() } };
});

vi.mock("@/app/[org]/scores/_components/FileManageModal", () => ({
  FileManageModal: ({ score, canManagePdf, canManageMidi }: Record<string, unknown>) => (
    <div>
      <p>FileManageModal: {(score as ScoreDetail).title}</p>
      <p>canManagePdf: {String(canManagePdf)}</p>
      <p>canManageMidi: {String(canManageMidi)}</p>
    </div>
  ),
}));

const sampleScore: ScoreDetail = {
  id: "score-1",
  title: "男声合唱のための〇〇",
  composer: null,
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
};

function renderModal(roles: string[], onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemberProvider memberId="member-self" roles={roles}>
          <ScoreFilesModal org="tokyo-men-choir" scoreId="score-1" onClose={onClose} />
        </MemberProvider>
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ScoreFilesModal", () => {
  it("読み込み中はスピナーを表示し、×で閉じられる", async () => {
    vi.mocked(scoresApi.getDetail).mockReturnValue(new Promise(() => {}));
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    const user = userEvent.setup();
    const { onClose } = renderModal(["admin"]);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });

  it("取得エラー時はエラーメッセージを表示し、×で閉じられる", async () => {
    vi.mocked(scoresApi.getDetail).mockRejectedValue(new Error("failed"));
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    const user = userEvent.setup();
    const { onClose } = renderModal(["admin"]);

    expect(await screen.findByText("楽譜の取得に失敗しました")).toBeInTheDocument();
    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });

  it("取得後はFileManageModalにscore/parts/権限を渡して表示する（admin）", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(sampleScore);
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    renderModal(["admin"]);

    expect(await screen.findByText("FileManageModal: 男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("canManagePdf: true")).toBeInTheDocument();
    expect(screen.getByText("canManageMidi: true")).toBeInTheDocument();
  });

  it("一般団員（member）はPDF・MIDIいずれの管理権限も渡らない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(sampleScore);
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    renderModal(["member"]);

    await screen.findByText("FileManageModal: 男声合唱のための〇〇");
    expect(screen.getByText("canManagePdf: false")).toBeInTheDocument();
    expect(screen.getByText("canManageMidi: false")).toBeInTheDocument();
  });

  it("scoreロール: PDF管理権限のみ渡る", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(sampleScore);
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    renderModal(["score"]);

    await screen.findByText("FileManageModal: 男声合唱のための〇〇");
    expect(screen.getByText("canManagePdf: true")).toBeInTheDocument();
    expect(screen.getByText("canManageMidi: false")).toBeInTheDocument();
  });
});
