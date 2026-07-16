import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseModal } from "../PurchaseModal";
import { scoresApi, type ScoreDetail, type ScorePurchaseRecord } from "@/lib/scores-api";
import { membersApi, type MemberProfile } from "@/lib/members-api";

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return {
    ...actual,
    scoresApi: {
      getPurchases: vi.fn(),
      putPurchases: vi.fn(),
    },
  };
});

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return {
    ...actual,
    membersApi: {
      ...actual.membersApi,
      list: vi.fn(),
    },
  };
});

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: null,
    nameEn: null,
    avatarUrl: null,
    part: null,
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: null,
    ...overrides,
  };
}

const score: ScoreDetail = {
  id: "score-1",
  title: "男声合唱のための〇〇",
  composer: null,
  arranger: null,
  accessLevel: "restricted",
  distributionPrice: 500,
  canAccessFiles: true,
  canDownload: true,
  files: [],
  isCommissioned: false,
  purchaseDate: null,
  distributionStart: null,
  notes: null,
  hasCollection: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PurchaseModal（表示）", () => {
  it("読み込み中はローディング表示をする", () => {
    vi.mocked(membersApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(scoresApi.getPurchases).mockReturnValue(new Promise(() => {}));
    render(<PurchaseModal orgSlug="o" score={score} onClose={vi.fn()} />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("読み込み失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.list).mockRejectedValue(new Error("読み込みに失敗しました"));
    vi.mocked(scoresApi.getPurchases).mockResolvedValue([]);
    render(<PurchaseModal orgSlug="o" score={score} onClose={vi.fn()} />);

    expect(await screen.findByText("読み込みに失敗しました")).toBeInTheDocument();
  });

  it("パート別（未設定は最後）にソートしてメンバーを表示し、購入済みメンバーは初期チェック済みにする", async () => {
    const members = [
      makeMember({ id: "m-none", nameJa: "無所属太郎", part: null }),
      makeMember({
        id: "m-tenor",
        nameJa: "テノール花子",
        part: { id: "p-tenor", name: "テノール1", voiceType: "tenor1", sortOrder: 1 },
      }),
      makeMember({
        id: "m-bass",
        nameJa: "ベース次郎",
        part: { id: "p-bass", name: "ベース1", voiceType: "bass1", sortOrder: 3 },
      }),
    ];
    vi.mocked(membersApi.list).mockResolvedValue(members);
    vi.mocked(scoresApi.getPurchases).mockResolvedValue([
      { memberId: "m-tenor" } as ScorePurchaseRecord,
    ]);
    render(<PurchaseModal orgSlug="o" score={score} onClose={vi.fn()} />);

    await screen.findByText("テノール花子");
    const groupHeadings = screen
      .getAllByText(/^(テノール1|ベース1|パート未設定)$/)
      .map((el) => el.textContent);
    expect(groupHeadings).toEqual(["テノール1", "ベース1", "パート未設定"]);

    expect(
      screen.getByRole("checkbox", { name: /テノール花子/ }) as HTMLInputElement,
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /ベース次郎/ }) as HTMLInputElement,
    ).not.toBeChecked();
    expect(screen.getByText("1名が購入済み")).toBeInTheDocument();
  });
});

describe("PurchaseModal（操作）", () => {
  it("チェックボックスをトグルすると購入済み人数が更新される", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember({ id: "m-1", nameJa: "山田太郎" })]);
    vi.mocked(scoresApi.getPurchases).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<PurchaseModal orgSlug="o" score={score} onClose={vi.fn()} />);

    await screen.findByText("山田太郎");
    expect(screen.getByText("0名が購入済み")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /山田太郎/ }));
    expect(screen.getByText("1名が購入済み")).toBeInTheDocument();
  });

  it("保存ボタンクリックでputPurchasesを呼び、成功後onCloseする", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember({ id: "m-1", nameJa: "山田太郎" })]);
    vi.mocked(scoresApi.getPurchases).mockResolvedValue([]);
    vi.mocked(scoresApi.putPurchases).mockResolvedValue({ updated: 1 });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PurchaseModal orgSlug="o" score={score} onClose={onClose} />);

    await user.click(await screen.findByRole("checkbox", { name: /山田太郎/ }));
    await user.click(screen.getByText("保存"));

    expect(scoresApi.putPurchases).toHaveBeenCalledWith("o", "score-1", { memberIds: ["m-1"] });
    expect(onClose).toHaveBeenCalled();
  });

  it("保存失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    vi.mocked(scoresApi.getPurchases).mockResolvedValue([]);
    vi.mocked(scoresApi.putPurchases).mockRejectedValue(new Error("保存に失敗しました"));
    const user = userEvent.setup();
    render(<PurchaseModal orgSlug="o" score={score} onClose={vi.fn()} />);

    await screen.findByText("0名が購入済み");
    await user.click(screen.getByText("保存"));

    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
  });

  it("キャンセルボタン・Escapeキーでoncloseを呼ぶ", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([]);
    vi.mocked(scoresApi.getPurchases).mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PurchaseModal orgSlug="o" score={score} onClose={onClose} />);

    await screen.findByText("0名が購入済み");
    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
