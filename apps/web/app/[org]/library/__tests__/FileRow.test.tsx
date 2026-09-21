import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileRow } from "../_components/FileRow";
import type { CrossFileItem } from "@/lib/files-api";

const file: CrossFileItem = {
  id: "stored-1",
  kind: "score",
  title: "男声合唱のための〇〇",
  subtitle: "楽譜PDF",
  fileName: "full.pdf",
  downloadUrl: "/api/v1/tokyo-men-choir/scores/score-1/files/sf-1/download",
  resourceLink: "/tokyo-men-choir/scores/score-1",
};

describe("FileRow", () => {
  it("タイトル・サブタイトルを表示する", () => {
    render(<FileRow file={file} />);

    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("楽譜PDF")).toBeInTheDocument();
  });

  it("タイトルリンクがdownloadUrlを指す", () => {
    render(<FileRow file={file} />);

    expect(screen.getByText("男声合唱のための〇〇").closest("a")).toHaveAttribute(
      "href",
      file.downloadUrl,
    );
  });

  it("「詳細へ」リンクがresourceLinkを指す", () => {
    render(<FileRow file={file} />);

    expect(screen.getByText("詳細へ")).toHaveAttribute("href", file.resourceLink);
  });
});
