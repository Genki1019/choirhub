import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LibraryPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { documentsApi, type OrgDocument } from "@/lib/documents-api";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documents-api")>("@/lib/documents-api");
  return {
    ...actual,
    documentsApi: {
      list: vi.fn(),
      upload: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <LibraryPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

const sampleDoc: OrgDocument = {
  id: "doc-1",
  title: "団則",
  category: "bylaws",
  accessLevel: "restricted",
  fileName: "bylaws.pdf",
  downloadUrl: "/api/v1/tokyo-men-choir/documents/doc-1/download",
};

beforeEach(() => {
  vi.resetAllMocks();
  searchParams = new URLSearchParams();
});

describe("LibraryPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(documentsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(documentsApi.list).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("資料の取得に失敗しました")).toBeInTheDocument();
  });

  it("0件の場合は空表示を出す", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("登録されている資料はありません")).toBeInTheDocument();
  });
});

describe("LibraryPage（一覧表示）", () => {
  it("タイトル・ファイル名・accessLevelバッジを表示する", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    renderPage();

    expect(await screen.findByText("団則")).toBeInTheDocument();
    expect(screen.getByText("bylaws.pdf")).toBeInTheDocument();
    expect(screen.getByText("団員限定")).toBeInTheDocument();
  });
});

describe("LibraryPage（カテゴリタブ）", () => {
  it("タブをクリックするとcategoryクエリ付きでURLを置き換える", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("登録されている資料はありません");
    await user.click(screen.getByText("議事録"));

    expect(replace).toHaveBeenCalledWith("/tokyo-men-choir/library?category=minutes");
  });

  it("category指定時にdocumentsApi.listがcategory付きで呼ばれる", async () => {
    searchParams = new URLSearchParams("category=minutes");
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage();

    await screen.findByText("登録されている資料はありません");
    expect(documentsApi.list).toHaveBeenCalledWith("tokyo-men-choir", "minutes");
  });
});

describe("LibraryPage（資料追加ボタンの権限）", () => {
  it("adminロール: 「資料を追加」ボタンを表示する", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage(["admin"]);

    expect(await screen.findByText("資料を追加")).toBeInTheDocument();
  });

  it("member等: 「資料を追加」ボタンを表示しない", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("登録されている資料はありません");
    expect(screen.queryByText("資料を追加")).not.toBeInTheDocument();
  });

  it("「資料を追加」クリックでアップロードモーダルを開き、キャンセルで閉じる", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("資料を追加"));
    expect(screen.getByRole("heading", { name: "資料を追加" })).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
    expect(screen.queryByRole("heading", { name: "資料を追加" })).not.toBeInTheDocument();
  });

  it("member等: 削除ボタンを表示しない", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    renderPage(["member"]);

    await screen.findByText("団則");
    expect(screen.queryByTitle("削除")).not.toBeInTheDocument();
  });
});

describe("LibraryPage（削除）", () => {
  it("削除確認モーダルで「削除する」を押すと削除され一覧から消える", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    vi.mocked(documentsApi.delete).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("団則");
    await user.click(screen.getByTitle("削除"));
    expect(screen.getByText("資料を削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByText("削除する"));

    expect(documentsApi.delete).toHaveBeenCalledWith("tokyo-men-choir", "doc-1");
    expect(await screen.findByText("登録されている資料はありません")).toBeInTheDocument();
  });
});
