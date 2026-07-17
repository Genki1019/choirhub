import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "../Sidebar";

let pathname = "/tokyo-men-choir";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  pathname = "/tokyo-men-choir";
  mockMatchMedia(true); // デフォルトはデスクトップ扱い
});

describe("Sidebar（基本ナビゲーション）", () => {
  it("基本のナビ項目を表示する", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["member"]} />);

    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(screen.getByText("メンバー")).toBeInTheDocument();
    expect(screen.getByText("スケジュール")).toBeInTheDocument();
    expect(screen.getByText("楽譜")).toBeInTheDocument();
    expect(screen.getByText("本番")).toBeInTheDocument();
    expect(screen.getByText("メール")).toBeInTheDocument();
    expect(screen.getByText("チケット")).toBeInTheDocument();
  });

  it("団体切替ボタンは/select-orgにリンクする", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["member"]} />);

    expect(screen.getByText("東京男声合唱団").closest("a")).toHaveAttribute("href", "/select-org");
  });

  it("visitorロールのみの場合はメール・チケットを表示しない", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["visitor"]} />);

    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(screen.queryByText("メール")).not.toBeInTheDocument();
    expect(screen.queryByText("チケット")).not.toBeInTheDocument();
  });

  it("visitorに加えて他のロールも持つ場合はメール・チケットを表示する", () => {
    render(
      <Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["visitor", "member"]} />,
    );

    expect(screen.getByText("メール")).toBeInTheDocument();
    expect(screen.getByText("チケット")).toBeInTheDocument();
  });

  it("現在のパスに一致するリンクをアクティブ表示する", () => {
    pathname = "/tokyo-men-choir/members";
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["member"]} />);

    expect(screen.getByText("メンバー").closest("a")).toHaveClass("text-brand-600");
    expect(screen.getByText("ホーム").closest("a")).not.toHaveClass("text-brand-600");
  });
});

describe("Sidebar（会計・finance+）", () => {
  it("financeロールの場合は会計を表示する", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["finance"]} />);
    expect(screen.getByText("会計")).toBeInTheDocument();
  });

  it("adminの場合は会計を表示する", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" isAdmin roles={["admin"]} />);
    expect(screen.getByText("会計")).toBeInTheDocument();
  });

  it("member（finance以外）の場合は会計を表示しない", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["member"]} />);
    expect(screen.queryByText("会計")).not.toBeInTheDocument();
  });
});

describe("Sidebar（設定アコーディオン）", () => {
  it("member（admin・finance以外）の場合は設定を表示しない", () => {
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["member"]} />);
    expect(screen.queryByText("設定")).not.toBeInTheDocument();
  });

  it("adminの場合は設定を表示し全サブ項目を表示する", async () => {
    const user = userEvent.setup();
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" isAdmin roles={["admin"]} />);

    await user.click(screen.getByText("設定"));

    expect(screen.getByText("団体情報")).toBeInTheDocument();
    expect(screen.getByText("パート管理")).toBeInTheDocument();
    expect(screen.getByText("会費設定")).toBeInTheDocument();
    expect(screen.getByText("支出カテゴリ")).toBeInTheDocument();
    expect(screen.getByText("メンバー区分")).toBeInTheDocument();
    expect(screen.getByText("イベント区分")).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は設定サブ項目が会費設定・支出カテゴリのみになる", async () => {
    const user = userEvent.setup();
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["finance"]} />);

    await user.click(screen.getByText("設定"));

    expect(screen.getByText("会費設定")).toBeInTheDocument();
    expect(screen.getByText("支出カテゴリ")).toBeInTheDocument();
    expect(screen.queryByText("団体情報")).not.toBeInTheDocument();
    expect(screen.queryByText("パート管理")).not.toBeInTheDocument();
    expect(screen.queryByText("メンバー区分")).not.toBeInTheDocument();
    expect(screen.queryByText("イベント区分")).not.toBeInTheDocument();
  });

  it("クリックで開閉しaria-expandedが切り替わる", async () => {
    const user = userEvent.setup();
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" isAdmin roles={["admin"]} />);

    const toggle = screen.getByText("設定").closest("button")!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("団体情報")).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("団体情報")).not.toBeInTheDocument();
  });

  it("設定配下のパスにいる場合は初期状態で開いている", () => {
    pathname = "/tokyo-men-choir/settings/parts";
    render(<Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" isAdmin roles={["admin"]} />);

    expect(screen.getByText("パート管理")).toBeInTheDocument();
  });
});

describe("Sidebar（モバイル表示）", () => {
  it("メニューを閉じるボタンでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Sidebar
        org="tokyo-men-choir"
        orgName="東京男声合唱団"
        roles={["member"]}
        isOpen
        onClose={onClose}
      />,
    );

    await user.click(screen.getByLabelText("メニューを閉じる"));
    expect(onClose).toHaveBeenCalled();
  });

  it("isOpen時は背景オーバーレイをクリックするとonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Sidebar
        org="tokyo-men-choir"
        orgName="東京男声合唱団"
        roles={["member"]}
        isOpen
        onClose={onClose}
      />,
    );

    const overlay = container.querySelector(".bg-black\\/30")!;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("isOpen: falseの場合は背景オーバーレイを表示しない", () => {
    const { container } = render(
      <Sidebar org="tokyo-men-choir" orgName="東京男声合唱団" roles={["member"]} />,
    );
    expect(container.querySelector(".bg-black\\/30")).not.toBeInTheDocument();
  });

  it("モバイル（デスクトップ幅未満）ではマウント時にonCloseが呼ばれる", () => {
    mockMatchMedia(false);
    const onClose = vi.fn();
    render(
      <Sidebar
        org="tokyo-men-choir"
        orgName="東京男声合唱団"
        roles={["member"]}
        isOpen
        onClose={onClose}
      />,
    );

    expect(onClose).toHaveBeenCalled();
  });
});
