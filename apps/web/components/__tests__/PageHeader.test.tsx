import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("タイトルを表示する", () => {
    render(<PageHeader title="メンバー" />);
    expect(screen.getByRole("heading", { name: "メンバー" })).toBeInTheDocument();
  });

  it("subtitleを指定した場合に表示する", () => {
    render(<PageHeader title="第10回定期演奏会" subtitle="2026年3月開催" />);
    expect(screen.getByText("2026年3月開催")).toBeInTheDocument();
  });

  it("subtitleにブロック要素を含むReactNodeを渡せる", () => {
    render(
      <PageHeader
        title="本番タイトル"
        subtitle={
          <div>
            <span>2026年3月開催</span>
          </div>
        }
      />,
    );
    expect(screen.getByText("2026年3月開催")).toBeInTheDocument();
  });

  it("subtitleを指定しない場合は表示しない", () => {
    render(<PageHeader title="メンバー" />);
    expect(screen.queryByText("2026年3月開催")).not.toBeInTheDocument();
  });

  it("backHrefを指定した場合に戻るリンクを表示する", () => {
    render(<PageHeader title="楽譜詳細" backHref="/tokyo-men-choir/scores" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/tokyo-men-choir/scores");
  });

  it("backHrefを指定しない場合は戻るリンクを表示しない", () => {
    render(<PageHeader title="メンバー" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("actionsスロットの内容を表示する", () => {
    render(<PageHeader title="メンバー" actions={<button>招待</button>} />);
    expect(screen.getByRole("button", { name: "招待" })).toBeInTheDocument();
  });

  it("badgeを指定した場合はタイトルと並べて表示する", () => {
    render(<PageHeader title="第10回定期演奏会" badge={<span>開催予定</span>} />);
    expect(screen.getByRole("heading", { name: "第10回定期演奏会" })).toBeInTheDocument();
    expect(screen.getByText("開催予定")).toBeInTheDocument();
  });

  it("badgeを指定しない場合はタイトルのみ表示する", () => {
    render(<PageHeader title="メンバー" />);
    expect(screen.queryByText("開催予定")).not.toBeInTheDocument();
  });

  it("childrenをヘッダー内に描画する", () => {
    render(
      <PageHeader title="チケット">
        <div data-testid="tabs">タブ</div>
      </PageHeader>,
    );
    expect(screen.getByTestId("tabs")).toBeInTheDocument();
  });
});
