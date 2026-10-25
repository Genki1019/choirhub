import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadModal } from "../_components/UploadModal";
import { documentsApi, type OrgDocument } from "@/lib/documents-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documents-api")>("@/lib/documents-api");
  return { ...actual, documentsApi: { upload: vi.fn() } };
});

const pdf = () => new File(["%PDF-1.4"], "bylaws.pdf", { type: "application/pdf" });

const uploaded: OrgDocument = {
  id: "doc-1",
  title: "団則",
  category: "bylaws",
  accessLevel: "restricted",
  fileName: "bylaws.pdf",
  downloadUrl: "/api/v1/o/documents/doc-1/download",
};

function renderModal(overrides: Partial<Parameters<typeof UploadModal>[0]> = {}) {
  const props = {
    org: "o",
    defaultCategory: "minutes" as const,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
  render(<UploadModal {...props} />);
  return props;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("UploadModal", () => {
  it("開くとタイトルの欄にフォーカスが入り、カテゴリは表示中のタブ・公開範囲は団員限定で始まる", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "資料を追加" })).toBeInTheDocument();
    expect(screen.getByLabelText(/タイトル/)).toHaveFocus();
    expect(screen.getByLabelText("カテゴリ")).toHaveValue("minutes");
    expect(screen.getByLabelText("公開範囲")).toHaveValue("restricted");
  });

  it("タイトルは100文字までしか入力できない", () => {
    renderModal();

    expect(screen.getByLabelText(/タイトル/)).toHaveAttribute("maxLength", "100");
  });

  it("ファイルを選ばずにタイトルの欄でEnterを押すと、理由を出して送らない", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/タイトル/), "団則{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("ファイルを選択してください");
    expect(documentsApi.upload).not.toHaveBeenCalled();
  });

  it("入力してEnterを押すとアップロードし、成功したらonSuccessを呼ぶ", async () => {
    vi.mocked(documentsApi.upload).mockResolvedValue(uploaded);
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.upload(screen.getByLabelText(/ファイル（PDF）/), pdf());
    await user.type(screen.getByLabelText(/タイトル/), " 団則 {Enter}");

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(documentsApi.upload).toHaveBeenCalledWith("o", expect.any(File), {
      title: "団則",
      category: "minutes",
      accessLevel: "restricted",
    });
  });

  it("失敗が4xxならAPIの理由を出し、モーダルは閉じない", async () => {
    vi.mocked(documentsApi.upload).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "資料はPDF形式でアップロードしてください", 400),
    );
    const user = userEvent.setup();
    const { onSuccess, onClose } = renderModal();

    await user.upload(screen.getByLabelText(/ファイル（PDF）/), pdf());
    await user.type(screen.getByLabelText(/タイトル/), "団則");
    await user.click(screen.getByRole("button", { name: "アップロード" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "資料はPDF形式でアップロードしてください",
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("失敗が5xxでも空でない文言を出す", async () => {
    vi.mocked(documentsApi.upload).mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    const user = userEvent.setup();
    renderModal();

    await user.upload(screen.getByLabelText(/ファイル（PDF）/), pdf());
    await user.type(screen.getByLabelText(/タイトル/), "団則");
    await user.click(screen.getByRole("button", { name: "アップロード" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アップロードに失敗しました。もう一度お試しください。",
    );
  });

  it("アップロード中はEscでも閉じない", async () => {
    vi.mocked(documentsApi.upload).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.upload(screen.getByLabelText(/ファイル（PDF）/), pdf());
    await user.type(screen.getByLabelText(/タイトル/), "団則");
    await user.click(screen.getByRole("button", { name: "アップロード" }));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc・×・キャンセルで閉じる", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard("{Escape}");
    await user.click(screen.getByLabelText("閉じる"));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("アップロード中にもう一度押しても二重に送らず、ボタンは無効として読み上げる（フォーカスを外さない）", async () => {
    vi.mocked(documentsApi.upload).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    await user.upload(screen.getByLabelText(/ファイル（PDF）/), pdf());
    await user.type(screen.getByLabelText(/タイトル/), "団則");
    const button = screen.getByRole("button", { name: "アップロード" });
    await user.click(button);
    await user.click(button);

    expect(documentsApi.upload).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });
});
