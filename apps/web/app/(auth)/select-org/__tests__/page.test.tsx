import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectOrgPage from "../page";
import { authApi, ApiClientError } from "@/lib/auth-api";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      me: vi.fn(),
      createOrg: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
});

describe("SelectOrgPage（表示）", () => {
  it("団体一覧を表示する（パート名・在団状況・ロールを含む）", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { id: "u1", nameJa: "山田太郎", email: "user@example.com", avatarUrl: null },
      orgs: [
        {
          orgSlug: "choir-a",
          orgName: "男声合唱団A",
          roles: ["member", "tech"],
          partName: "Tenor I",
          status: "active",
        },
        {
          orgSlug: "choir-b",
          orgName: "混声合唱団B",
          roles: ["member"],
          partName: "Bass",
          status: "offstage",
        },
      ],
    });
    render(<SelectOrgPage />);

    expect(await screen.findByText("男声合唱団A")).toBeInTheDocument();
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("在団")).toBeInTheDocument();
    expect(screen.getByText("技術系")).toBeInTheDocument();

    expect(screen.getByText("混声合唱団B")).toBeInTheDocument();
    expect(screen.getByText("休団")).toBeInTheDocument();
  });

  it("所属団体が0件の場合は空状態を表示する", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { id: "u1", nameJa: "山田太郎", email: "user@example.com", avatarUrl: null },
      orgs: [],
    });
    render(<SelectOrgPage />);

    expect(await screen.findByText("所属している団体がありません")).toBeInTheDocument();
  });

  it("401エラー時はログイン画面へ自動リダイレクトする", async () => {
    vi.mocked(authApi.me).mockRejectedValue(
      new ApiClientError("UNAUTHORIZED", "unauthorized", 401),
    );
    render(<SelectOrgPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });

  it("401以外のエラー時は0件時とは異なるエラーメッセージを表示する", async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error("network error"));
    render(<SelectOrgPage />);

    expect(
      await screen.findByText("団体情報の取得に失敗しました。しばらくしてから再度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("所属している団体がありません")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("SelectOrgPage（団体選択・ログアウト）", () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { id: "u1", nameJa: "山田太郎", email: "user@example.com", avatarUrl: null },
      orgs: [
        {
          orgSlug: "choir-a",
          orgName: "男声合唱団A",
          roles: ["member"],
          partName: null,
          status: "active",
        },
      ],
    });
  });

  it("団体カードをクリックすると/{orgSlug}へ遷移する", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("男声合唱団A"));

    expect(push).toHaveBeenCalledWith("/choir-a");
  });

  it("ログアウトをクリックするとログアウトAPIを呼び/loginへ遷移する", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("ログアウト"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(push).toHaveBeenCalledWith("/login");
  });
});

describe("SelectOrgPage（新しい団体を作成）", () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: { id: "u1", nameJa: "山田太郎", email: "user@example.com", avatarUrl: null },
      orgs: [],
    });
  });

  it("団体名の入力からスラグが自動生成される", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");

    expect(screen.getByLabelText(/スラグ/)).toHaveValue("my-choir");
  });

  it("スラグを手動編集すると団体名からの自動生成が止まる", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.clear(screen.getByLabelText(/スラグ/));
    await user.type(screen.getByLabelText(/スラグ/), "custom-slug");
    await user.type(screen.getByLabelText("団体名"), " Extra");

    expect(screen.getByLabelText(/スラグ/)).toHaveValue("custom-slug");
  });

  it("団体名またはスラグが未入力の場合は作成ボタンが無効化される", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    expect(screen.getByText("作成する")).toBeDisabled();

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    expect(screen.getByText("作成する")).not.toBeDisabled();

    await user.clear(screen.getByLabelText(/スラグ/));
    expect(screen.getByText("作成する")).toBeDisabled();
  });

  it("[×]ボタンでフォームを閉じられる", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    expect(screen.getByLabelText("団体名")).toBeInTheDocument();

    await user.click(screen.getByLabelText("団体作成フォームを閉じる"));
    expect(screen.queryByLabelText("団体名")).not.toBeInTheDocument();
  });

  it("作成成功時はauthApi.createOrgが呼ばれ/{orgSlug}へ遷移する", async () => {
    vi.mocked(authApi.createOrg).mockResolvedValue({
      orgSlug: "my-choir",
      orgName: "My Choir",
    });
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.click(screen.getByText("作成する"));

    expect(authApi.createOrg).toHaveBeenCalledWith({ name: "My Choir", slug: "my-choir" });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/my-choir");
    });
  });

  it("409エラー時はスラグ重複メッセージを表示する", async () => {
    vi.mocked(authApi.createOrg).mockRejectedValue(new ApiClientError("CONFLICT", "conflict", 409));
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.click(screen.getByText("作成する"));

    expect(await screen.findByText("このスラグはすでに使用されています")).toBeInTheDocument();
  });

  it("409以外のエラー時は汎用メッセージを表示する", async () => {
    vi.mocked(authApi.createOrg).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("新しい団体を作成"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.click(screen.getByText("作成する"));

    expect(
      await screen.findByText("作成に失敗しました。しばらくしてから再試行してください"),
    ).toBeInTheDocument();
  });
});
