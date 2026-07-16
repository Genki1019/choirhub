import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthlyOrganizerCard } from "../MonthlyOrganizerCard";
import { homeApi } from "@/lib/home-api";

vi.mock("@/lib/home-api", () => ({
  homeApi: {
    setMonthlyOrganizer: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MonthlyOrganizerCard（表示のみ）", () => {
  it("organizerが未設定の場合: 「未設定」をグレー文字で表示する", () => {
    render(
      <MonthlyOrganizerCard
        organizer={null}
        isTicketManager={false}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    const text = screen.getByText("未設定");
    expect(text).toHaveClass("text-gray-300");
    expect(text).not.toHaveClass("text-brand-500");
  });

  it("organizerが設定済みの場合: パート名をブランドカラーで表示する", () => {
    render(
      <MonthlyOrganizerCard
        organizer="Tenor I"
        isTicketManager={false}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    const text = screen.getByText("Tenor I");
    expect(text).toHaveClass("text-brand-500");
    expect(text).not.toHaveClass("text-gray-300");
  });

  it("isTicketManagerがfalseの場合: 編集ボタンを表示しない", () => {
    render(
      <MonthlyOrganizerCard
        organizer="Tenor I"
        isTicketManager={false}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("MonthlyOrganizerCard（編集操作）", () => {
  it("鉛筆ボタンを押すと入力欄が表示される", async () => {
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer="Tenor I"
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByPlaceholderText("パート名を入力")).toBeInTheDocument();
  });

  it("パート名を入力して保存すると、APIが呼ばれonSavedにも渡される", async () => {
    vi.mocked(homeApi.setMonthlyOrganizer).mockResolvedValue({ monthlyOrganizer: "Bass II" });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <MonthlyOrganizerCard
        organizer={null}
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "Bass II");
    await user.click(screen.getByLabelText("保存"));

    await waitFor(() => {
      expect(homeApi.setMonthlyOrganizer).toHaveBeenCalledWith("tokyo-men-choir", "Bass II");
    });
    expect(onSaved).toHaveBeenCalledWith("Bass II");
  });

  it("キャンセルすると入力を破棄し編集モードを終了する", async () => {
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer="Tenor I"
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "変更後");
    await user.click(screen.getByLabelText("キャンセル"));

    expect(screen.queryByPlaceholderText("パート名を入力")).not.toBeInTheDocument();
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(homeApi.setMonthlyOrganizer).not.toHaveBeenCalled();
  });

  it("Enterキーで保存できる", async () => {
    vi.mocked(homeApi.setMonthlyOrganizer).mockResolvedValue({ monthlyOrganizer: "Bass II" });
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer={null}
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "Bass II{Enter}");

    await waitFor(() => {
      expect(homeApi.setMonthlyOrganizer).toHaveBeenCalledWith("tokyo-men-choir", "Bass II");
    });
  });

  it("Escapeキーでキャンセルできる", async () => {
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer="Tenor I"
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "変更後{Escape}");

    expect(screen.queryByPlaceholderText("パート名を入力")).not.toBeInTheDocument();
    expect(homeApi.setMonthlyOrganizer).not.toHaveBeenCalled();
  });

  it("保存中は保存ボタンがdisabledになる", async () => {
    let resolveSave: (value: { monthlyOrganizer: string | null }) => void;
    vi.mocked(homeApi.setMonthlyOrganizer).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer={null}
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "Bass II");
    await user.click(screen.getByLabelText("保存"));

    expect(screen.getByLabelText("保存")).toBeDisabled();

    resolveSave!({ monthlyOrganizer: "Bass II" });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("パート名を入力")).not.toBeInTheDocument();
    });
  });

  it("保存が完了すると編集モードを抜ける", async () => {
    vi.mocked(homeApi.setMonthlyOrganizer).mockResolvedValue({ monthlyOrganizer: "Bass II" });
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer={null}
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "Bass II");
    await user.click(screen.getByLabelText("保存"));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("パート名を入力")).not.toBeInTheDocument();
    });
  });

  it("空文字で保存するとnullとして送信される", async () => {
    vi.mocked(homeApi.setMonthlyOrganizer).mockResolvedValue({ monthlyOrganizer: null });
    const user = userEvent.setup();
    render(
      <MonthlyOrganizerCard
        organizer="Tenor I"
        isTicketManager={true}
        org="tokyo-men-choir"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.clear(screen.getByPlaceholderText("パート名を入力"));
    await user.click(screen.getByLabelText("保存"));

    await waitFor(() => {
      expect(homeApi.setMonthlyOrganizer).toHaveBeenCalledWith("tokyo-men-choir", null);
    });
  });
});
