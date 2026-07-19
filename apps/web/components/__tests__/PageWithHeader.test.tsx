import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageWithHeader } from "../PageWithHeader";

describe("PageWithHeader", () => {
  it("loading中はスピナーを表示しchildrenを表示しない", () => {
    render(
      <PageWithHeader title="設定" loading>
        <div>本文</div>
      </PageWithHeader>,
    );
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    expect(screen.queryByText("本文")).not.toBeInTheDocument();
  });

  it("loading完了後はchildrenを表示する", () => {
    render(
      <PageWithHeader title="設定" loading={false}>
        <div>本文</div>
      </PageWithHeader>,
    );
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    expect(screen.getByText("本文")).toBeInTheDocument();
  });

  it("loadingを省略した場合はchildrenを表示する", () => {
    render(
      <PageWithHeader title="設定">
        <div>本文</div>
      </PageWithHeader>,
    );
    expect(screen.getByText("本文")).toBeInTheDocument();
  });

  it("title・badge・actions・backHrefをPageHeaderに渡す", () => {
    render(
      <PageWithHeader
        title="メンバー"
        badge={<span>公開中</span>}
        backHref="/tokyo-men-choir"
        actions={<button>招待</button>}
      >
        <div>本文</div>
      </PageWithHeader>,
    );
    expect(screen.getByRole("heading", { name: "メンバー" })).toBeInTheDocument();
    expect(screen.getByText("公開中")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tokyo-men-choir");
    expect(screen.getByRole("button", { name: "招待" })).toBeInTheDocument();
  });

  it("mainClassNameを指定した場合はchildrenをラップするdivに適用する", () => {
    render(
      <PageWithHeader title="設定" mainClassName="mx-auto max-w-lg space-y-4">
        <div>本文</div>
      </PageWithHeader>,
    );
    const wrapper = screen.getByText("本文").parentElement;
    expect(wrapper).toHaveClass("max-w-lg");
  });

  it("mainClassNameを指定しない場合はchildrenをそのまま描画する", () => {
    render(
      <PageWithHeader title="設定">
        <div data-testid="content">本文</div>
      </PageWithHeader>,
    );
    const content = screen.getByTestId("content");
    expect(content.parentElement).not.toHaveClass("max-w-lg");
  });
});
