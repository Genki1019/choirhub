import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourceFilesModal } from "../_components/ResourceFilesModal";
import type { AttachmentFile } from "@/lib/file-attachment-api";

function renderModal(canManage: boolean, onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listFiles = vi
    .fn()
    .mockResolvedValue([
      { id: "file-1", label: "フライヤー", fileName: "flyer.pdf" } satisfies AttachmentFile,
    ]);
  const uploadFile = vi.fn();
  const deleteFile = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <ResourceFilesModal
        title="第20回定期演奏会"
        queryKey={["test-resource-files"]}
        canManage={canManage}
        listFiles={listFiles}
        uploadFile={uploadFile}
        deleteFile={deleteFile}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );

  return { listFiles, uploadFile, deleteFile, onClose };
}

describe("ResourceFilesModal", () => {
  it("タイトルを表示し、対象の既存ファイル一覧を表示する", async () => {
    renderModal(true);

    expect(screen.getByRole("heading", { name: "第20回定期演奏会" })).toBeInTheDocument();
    expect(await screen.findByText("flyer.pdf")).toBeInTheDocument();
  });

  it("canManage=falseの場合はアップロード欄を表示しない", async () => {
    renderModal(false);

    await screen.findByText("flyer.pdf");
    expect(screen.queryByRole("button", { name: /追加/ })).not.toBeInTheDocument();
  });

  it("canManage=trueの場合はアップロード欄を表示する", async () => {
    renderModal(true);

    await screen.findByText("flyer.pdf");
    expect(screen.getByRole("button", { name: /追加/ })).toBeInTheDocument();
  });

  it("×ボタンでonCloseが呼ばれる", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(true);

    await user.click(screen.getByLabelText("閉じる"));

    expect(onClose).toHaveBeenCalled();
  });
});
