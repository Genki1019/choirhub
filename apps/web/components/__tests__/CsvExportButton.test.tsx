import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiClientError } from "@/lib/api-client";
import { CsvExportButton } from "../CsvExportButton";

describe("CsvExportButton", () => {
  it("既定ラベルは「CSV出力」", () => {
    render(<CsvExportButton onDownload={vi.fn()} />);
    expect(screen.getByRole("button", { name: "CSV出力" })).toBeInTheDocument();
  });

  it("クリックでonDownloadを実行する", async () => {
    const onDownload = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CsvExportButton onDownload={onDownload} label="名簿CSV" />);

    await user.click(screen.getByRole("button", { name: "名簿CSV" }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ダウンロード中はボタンが無効化される", async () => {
    let resolve: () => void = () => {};
    const onDownload = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<CsvExportButton onDownload={onDownload} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();

    resolve();
    await vi.waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  });

  it("失敗時はAPIのエラーメッセージを表示し、再クリックで消える", async () => {
    const onDownload = vi
      .fn()
      .mockRejectedValueOnce(new ApiClientError("FORBIDDEN", "管理者のみ実行できます", 403))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<CsvExportButton onDownload={onDownload} />);

    await user.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("管理者のみ実行できます");

    await user.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
