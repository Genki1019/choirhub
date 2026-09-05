import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FileAttachmentSection } from "../FileAttachmentSection";
import type { AttachmentFile } from "@/lib/file-attachment-api";

function renderSection(props: {
  files?: AttachmentFile[];
  canManage?: boolean;
  listFiles?: () => Promise<AttachmentFile[]>;
  uploadFile?: (file: File, label: string) => Promise<AttachmentFile>;
  deleteFile?: (fileId: string) => Promise<void>;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listFiles = props.listFiles ?? vi.fn().mockResolvedValue(props.files ?? []);
  const uploadFile = props.uploadFile ?? vi.fn();
  const deleteFile = props.deleteFile ?? vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <FileAttachmentSection
        queryKey={["test-files"]}
        canManage={props.canManage ?? true}
        listFiles={listFiles}
        uploadFile={uploadFile}
        deleteFile={deleteFile}
      />
    </QueryClientProvider>,
  );

  return { listFiles, uploadFile, deleteFile };
}

function makeFile(overrides: Partial<AttachmentFile> = {}): AttachmentFile {
  return {
    id: "file-1",
    label: "フライヤー",
    fileName: "flyer.pdf",
    downloadUrl: "/api/v1/o/concerts/c1/files/file-1/download",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("FileAttachmentSection（表示）", () => {
  it("取得中は「読み込み中…」を表示する", () => {
    renderSection({ listFiles: () => new Promise(() => {}) });

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("0件の場合は登録されているファイルがない旨を表示する", async () => {
    renderSection({ files: [] });

    expect(await screen.findByText("登録されているファイルはありません")).toBeInTheDocument();
  });

  it("ファイル一覧をラベル付きで表示する", async () => {
    renderSection({ files: [makeFile()] });

    expect(await screen.findByText("flyer.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("フライヤー").length).toBeGreaterThan(0);
  });

  it("canManage=falseの場合はアップロードフォーム・削除ボタンを表示しない", async () => {
    renderSection({ files: [makeFile()], canManage: false });

    await screen.findByText("flyer.pdf");
    expect(screen.queryByRole("button", { name: "追加" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("削除")).not.toBeInTheDocument();
  });
});

describe("FileAttachmentSection（アップロード）", () => {
  it("ファイル未選択で追加を押すとエラーを表示する", async () => {
    const user = userEvent.setup();
    renderSection({ files: [] });

    await screen.findByText("登録されているファイルはありません");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(await screen.findByText("ファイルを選択してください")).toBeInTheDocument();
  });

  it("「その他」選択時にラベル未入力だとエラーを表示する", async () => {
    const user = userEvent.setup();
    renderSection({ files: [] });

    await screen.findByText("登録されているファイルはありません");
    await user.selectOptions(screen.getByRole("combobox"), "その他");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "a.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(await screen.findByText("ラベルを入力してください")).toBeInTheDocument();
  });

  it("正常にアップロードすると一覧に追加される", async () => {
    const uploadFile = vi.fn().mockResolvedValue(makeFile({ id: "new-file", fileName: "new.pdf" }));
    const user = userEvent.setup();
    renderSection({ files: [], uploadFile });

    await screen.findByText("登録されているファイルはありません");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "new.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(await screen.findByText("new.pdf")).toBeInTheDocument();
    expect(uploadFile).toHaveBeenCalledWith(file, "フライヤー");
  });
});

describe("FileAttachmentSection（削除）", () => {
  it("削除確認モーダルでキャンセルすると削除されない", async () => {
    const deleteFile = vi.fn();
    const user = userEvent.setup();
    renderSection({ files: [makeFile()], deleteFile });

    await screen.findByText("flyer.pdf");
    await user.click(screen.getByTitle("削除"));
    expect(screen.getByText("ファイルを削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(deleteFile).not.toHaveBeenCalled();
    expect(screen.getByText("flyer.pdf")).toBeInTheDocument();
  });

  it("削除を確定すると一覧から消える", async () => {
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSection({ files: [makeFile()], deleteFile });

    await screen.findByText("flyer.pdf");
    await user.click(screen.getByTitle("削除"));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(deleteFile).toHaveBeenCalledWith("file-1"));
    await waitFor(() => expect(screen.queryByText("flyer.pdf")).not.toBeInTheDocument());
  });

  it("削除失敗時はモーダル内にエラーを表示し、ファイルは一覧に残る", async () => {
    const deleteFile = vi.fn().mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderSection({ files: [makeFile()], deleteFile });

    await screen.findByText("flyer.pdf");
    await user.click(screen.getByTitle("削除"));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(await screen.findByText("削除に失敗しました")).toBeInTheDocument();
    expect(screen.getByText("ファイルを削除しますか？")).toBeInTheDocument();
  });

  it("削除処理中はキャンセル・削除するボタンが無効化される（二重送信防止）", async () => {
    let resolveDelete: () => void = () => {};
    const deleteFile = vi.fn(() => new Promise<void>((resolve) => (resolveDelete = resolve)));
    const user = userEvent.setup();
    renderSection({ files: [makeFile()], deleteFile });

    await screen.findByText("flyer.pdf");
    await user.click(screen.getByTitle("削除"));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(deleteFile).toHaveBeenCalledTimes(1);

    resolveDelete();
    await waitFor(() => expect(screen.queryByText("flyer.pdf")).not.toBeInTheDocument());
  });
});
