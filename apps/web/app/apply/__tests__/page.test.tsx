import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ApplyPage from "../page";

vi.mock("@/lib/org-applications-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/org-applications-api")>(
    "@/lib/org-applications-api",
  );
  return {
    ...actual,
    orgApplicationsApi: {
      create: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ApplyPage", () => {
  it("団体作成申請フォームを表示する", () => {
    render(<ApplyPage />);

    expect(screen.getByLabelText("団体名")).toBeInTheDocument();
    expect(screen.getByLabelText("管理者氏名")).toBeInTheDocument();
    expect(screen.getByLabelText("管理者メールアドレス")).toBeInTheDocument();
  });

  it("ログインへのリンクを表示する", () => {
    render(<ApplyPage />);

    const link = screen.getByText("ログイン");
    expect(link).toHaveAttribute("href", "/login");
  });
});
