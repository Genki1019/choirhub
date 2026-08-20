import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgApplicationForm } from "../OrgApplicationForm";
import { orgApplicationsApi } from "@/lib/org-applications-api";
import { ApiClientError } from "@/lib/auth-api";

vi.mock("@/lib/org-applications-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/org-applications-api")>(
    "@/lib/org-applications-api",
  );
  return {
    ...actual,
    orgApplicationsApi: {
      create: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OrgApplicationForm", () => {
  it("パート構成の選択肢は混声四部→女声三部→男声四部→カスタムの順で表示される", () => {
    render(<OrgApplicationForm />);

    const options = within(screen.getByLabelText("パート構成")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "混声四部",
      "女声三部",
      "男声四部",
      "カスタム（あとで手動設定）",
    ]);
  });

  it("initialName/initialEmailで氏名・メールがプリフィルされる", () => {
    render(<OrgApplicationForm initialName="山田太郎" initialEmail="taro@example.com" />);

    expect(screen.getByLabelText("管理者氏名")).toHaveValue("山田太郎");
    expect(screen.getByLabelText("管理者メールアドレス")).toHaveValue("taro@example.com");
  });

  it("団体名の入力からスラグが自動生成される", async () => {
    const user = userEvent.setup();
    render(<OrgApplicationForm />);

    await user.type(screen.getByLabelText("団体名"), "My Choir");

    expect(screen.getByLabelText(/スラグ/)).toHaveValue("my-choir");
  });

  it("スラグを手動編集すると団体名からの自動生成が止まる", async () => {
    const user = userEvent.setup();
    render(<OrgApplicationForm />);

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.clear(screen.getByLabelText(/スラグ/));
    await user.type(screen.getByLabelText(/スラグ/), "custom-slug");
    await user.type(screen.getByLabelText("団体名"), " Extra");

    expect(screen.getByLabelText(/スラグ/)).toHaveValue("custom-slug");
  });

  it("未入力で送信すると入力エラーが表示される", async () => {
    const user = userEvent.setup();
    render(<OrgApplicationForm />);

    await user.click(screen.getByText("申請する"));

    expect(await screen.findByText("団体名を入力してください")).toBeInTheDocument();
    expect(orgApplicationsApi.create).not.toHaveBeenCalled();
  });

  it("送信成功時はorgApplicationsApi.createが呼ばれ確認メッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.create).mockResolvedValue({ message: "送信しました" });
    const user = userEvent.setup();
    render(<OrgApplicationForm />);

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.selectOptions(screen.getByLabelText("パート構成"), "women3");
    await user.type(screen.getByLabelText("管理者氏名"), "鈴木花子");
    await user.type(screen.getByLabelText("管理者メールアドレス"), "hanako@example.com");
    await user.click(screen.getByText("申請する"));

    expect(
      await screen.findByText("送信しました。システム管理者の承認をお待ちください。"),
    ).toBeInTheDocument();
    expect(orgApplicationsApi.create).toHaveBeenCalledWith({
      orgName: "My Choir",
      slug: "my-choir",
      templateKey: "women3",
      applicantName: "鈴木花子",
      applicantEmail: "hanako@example.com",
      message: undefined,
    });
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.create).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<OrgApplicationForm />);

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.type(screen.getByLabelText("管理者氏名"), "鈴木花子");
    await user.type(screen.getByLabelText("管理者メールアドレス"), "hanako@example.com");
    await user.click(screen.getByText("申請する"));

    expect(
      await screen.findByText("送信に失敗しました。しばらくしてから再試行してください"),
    ).toBeInTheDocument();
  });

  it("submitFn/successMessage/submitLabelを指定すると、それらが使われる", async () => {
    const submitFn = vi.fn().mockResolvedValue({ message: "作成しました" });
    const user = userEvent.setup();
    render(
      <OrgApplicationForm
        submitFn={submitFn}
        successMessage="団体を作成し、招待メールを送信しました。"
        submitLabel="作成する"
      />,
    );

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.type(screen.getByLabelText("管理者氏名"), "鈴木花子");
    await user.type(screen.getByLabelText("管理者メールアドレス"), "hanako@example.com");
    await user.click(screen.getByText("作成する"));

    expect(submitFn).toHaveBeenCalledWith(
      expect.objectContaining({ orgName: "My Choir", slug: "my-choir" }),
    );
    expect(orgApplicationsApi.create).not.toHaveBeenCalled();
    expect(await screen.findByText("団体を作成し、招待メールを送信しました。")).toBeInTheDocument();
  });

  it("409エラー時はスラグ重複メッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.create).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const user = userEvent.setup();
    render(<OrgApplicationForm />);

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.type(screen.getByLabelText("管理者氏名"), "鈴木花子");
    await user.type(screen.getByLabelText("管理者メールアドレス"), "hanako@example.com");
    await user.click(screen.getByText("申請する"));

    expect(await screen.findByText("このスラグはすでに使用されています")).toBeInTheDocument();
  });
});
