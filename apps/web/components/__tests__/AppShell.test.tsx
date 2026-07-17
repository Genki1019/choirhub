import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import AppShell from "../AppShell";
import { ApiClientError } from "@/lib/api-client";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tokyo-men-choir",
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

function renderShell(children: React.ReactNode = <div>ページ本文</div>) {
  return render(
    <AppShell
      org="tokyo-men-choir"
      orgName="東京男声合唱団"
      isAdmin={false}
      roles={["member"]}
      nameJa="山田太郎"
      avatarUrl={null}
      memberId="member-1"
    >
      {children}
    </AppShell>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockMatchMedia(true);
});

describe("AppShell（構成）", () => {
  it("children・Sidebar・UserMenu・AppFooterを表示する", () => {
    renderShell();

    expect(screen.getByText("ページ本文")).toBeInTheDocument();
    expect(screen.getByText("ホーム")).toBeInTheDocument(); // Sidebar
    expect(screen.getByTitle("山田太郎")).toBeInTheDocument(); // UserMenu
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument(); // AppFooter
  });

  it("ハンバーガーボタンでサイドバーの開閉状態が切り替わる", async () => {
    mockMatchMedia(false); // モバイル扱い（初期は閉じている）
    const user = userEvent.setup();
    const { container } = renderShell();

    expect(container.querySelector(".bg-black\\/30")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("メニューを開閉する"));
    expect(container.querySelector(".bg-black\\/30")).toBeInTheDocument();

    await user.click(screen.getByLabelText("メニューを開閉する"));
    expect(container.querySelector(".bg-black\\/30")).not.toBeInTheDocument();
  });
});

describe("AppShell（認証エラー処理）", () => {
  it("配下のクエリが401エラーの場合は/loginへリダイレクトする", async () => {
    function Probe() {
      useQuery({
        queryKey: ["probe"],
        queryFn: () => {
          throw new ApiClientError("UNAUTHORIZED", "unauthorized", 401);
        },
      });
      return null;
    }

    renderShell(<Probe />);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("配下のクエリが401以外のエラーの場合は/loginへリダイレクトしない", async () => {
    function Probe() {
      const { isError } = useQuery({
        queryKey: ["probe-500"],
        queryFn: () => {
          throw new ApiClientError("INTERNAL_ERROR", "error", 500);
        },
      });
      return <div>{isError ? "error" : "loading"}</div>;
    }

    renderShell(<Probe />);

    await screen.findByText("error");
    expect(push).not.toHaveBeenCalled();
  });
});
