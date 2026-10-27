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

  it("ダウンロード中はもう一度押しても出力せず、ボタンは無効として読み上げる（フォーカスを外さない）", async () => {
    let resolve: () => void = () => {};
    const onDownload = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<CsvExportButton onDownload={onDownload} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button")).not.toBeDisabled();

    resolve();
    await vi.waitFor(() =>
      expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "false"),
    );
  });

  it("失敗が5xxなら、空や英語ではなく代わりの文言を出す", async () => {
    const onDownload = vi.fn().mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    const user = userEvent.setup();
    render(<CsvExportButton onDownload={onDownload} />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CSVの出力に失敗しました。もう一度お試しください。",
    );
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

  it("同じ画面に複数あるときに区別できるよう、名前を付けたボタンはエラーの先頭に名前を出す", async () => {
    const onDownload = vi.fn().mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    const user = userEvent.setup();
    render(<CsvExportButton onDownload={onDownload} label="徴収一覧CSV" />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "徴収一覧CSV：CSVの出力に失敗しました。もう一度お試しください。",
    );
  });
});
