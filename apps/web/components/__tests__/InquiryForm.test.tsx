import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InquiryForm } from "../InquiryForm";
import { inquiriesApi } from "@/lib/inquiries-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/inquiries-api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/inquiries-api")>("@/lib/inquiries-api")),
  inquiriesApi: { create: vi.fn() },
}));

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("お名前"), "山田 太郎");
  await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
  await user.type(screen.getByLabelText("お問い合わせ内容"), "団体を復元してください");
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InquiryForm", () => {
  it("種類の初期値は「その他」", () => {
    render(<InquiryForm />);
    expect(screen.getByLabelText("お問い合わせの種類")).toHaveValue("other");
  });

  it("initialCategoryで種類を初期選択できる", () => {
    render(<InquiryForm initialCategory="org_restore" />);
    expect(screen.getByLabelText("お問い合わせの種類")).toHaveValue("org_restore");
  });

  it("必須項目が未入力の場合はエラーを表示し送信しない", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);

    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(await screen.findByText("お名前を入力してください")).toBeInTheDocument();
    expect(screen.getByText("有効なメールアドレスを入力してください")).toBeInTheDocument();
    expect(screen.getByText("お問い合わせ内容を入力してください")).toBeInTheDocument();
    expect(inquiriesApi.create).not.toHaveBeenCalled();
  });

  it("団体名が100文字を超える場合はエラーを表示し送信しない", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);

    await fillRequired(user);
    await user.click(screen.getByLabelText(/団体名/));
    await user.paste("あ".repeat(101));
    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(await screen.findByText("100文字以内で入力してください")).toBeInTheDocument();
    expect(inquiriesApi.create).not.toHaveBeenCalled();
  });

  it("送信すると入力内容でAPIを呼び、完了メッセージを表示する（空の団体名は送らない）", async () => {
    vi.mocked(inquiriesApi.create).mockResolvedValue({ message: "送信しました" });
    const user = userEvent.setup();
    render(<InquiryForm initialCategory="org_restore" />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(inquiriesApi.create).toHaveBeenCalledWith({
      category: "org_restore",
      name: "山田 太郎",
      email: "yamada@example.com",
      orgName: undefined,
      message: "団体を復元してください",
    });
    expect(await screen.findByText(/お問い合わせを受け付けました/)).toBeInTheDocument();
  });

  it("レート制限（429）の場合はサーバーのメッセージを表示する", async () => {
    vi.mocked(inquiriesApi.create).mockRejectedValue(
      new ApiClientError("TOO_MANY_REQUESTS", "しばらく時間をおいてから再試行してください", 429),
    );
    const user = userEvent.setup();
    render(<InquiryForm />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "しばらく時間をおいてから再試行してください",
    );
  });

  it("その他の失敗時は汎用メッセージを表示する", async () => {
    vi.mocked(inquiriesApi.create).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<InquiryForm />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("送信に失敗しました");
  });

  it("プライバシーポリシーへのリンクを表示する", () => {
    render(<InquiryForm />);
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
