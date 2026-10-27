import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddCategoryForm } from "../AddCategoryForm";
import { settingsApi } from "@/lib/settings-api";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      createEventCategory: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AddCategoryForm", () => {
  it("名前未入力の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<AddCategoryForm org="o" onCreated={vi.fn()} />);

    await user.click(screen.getByText("追加"));
    expect(await screen.findByText("名前を入力してください")).toBeInTheDocument();
  });

  it("名前・色を入力して追加するとcreateEventCategoryが呼ばれonCreatedが呼ばれる", async () => {
    vi.mocked(settingsApi.createEventCategory).mockResolvedValue({
      id: "cat-new",
      name: "合宿",
      slug: null,
      color: "#3B82F6",
      sortOrder: 3,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<AddCategoryForm org="o" onCreated={onCreated} />);

    await user.type(screen.getByPlaceholderText("区分名"), "合宿");
    await user.click(screen.getByText("追加"));

    expect(settingsApi.createEventCategory).toHaveBeenCalledWith("o", {
      name: "合宿",
      color: "#6B7280",
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "cat-new" }));
  });

  it("追加の失敗が4xxならAPIの理由を読み上げる", async () => {
    vi.mocked(settingsApi.createEventCategory).mockRejectedValue(
      new ApiClientError("CONFLICT", "同じ名前の区分がすでにあります", 409),
    );
    const user = userEvent.setup();
    render(<AddCategoryForm org="o" onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("区分名"), "練習");
    await user.click(screen.getByText("追加"));

    expect(await screen.findByRole("alert")).toHaveTextContent("同じ名前の区分がすでにあります");
  });

  it("追加の失敗が5xxなら、空や英語ではなく代わりの文言を出す", async () => {
    vi.mocked(settingsApi.createEventCategory).mockRejectedValue(
      new ApiClientError("UNKNOWN", "Internal Server Error", 500),
    );
    const user = userEvent.setup();
    render(<AddCategoryForm org="o" onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("区分名"), "練習");
    await user.click(screen.getByText("追加"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "区分の追加に失敗しました。もう一度お試しください。",
    );
  });

  it("追加中にもう一度押しても二重に送らず、ボタンは無効として読み上げる（フォーカスを外さない）", async () => {
    vi.mocked(settingsApi.createEventCategory).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<AddCategoryForm org="o" onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("区分名"), "練習");
    const button = screen.getByRole("button", { name: /追加/ });
    await user.click(button);
    await user.click(button);

    expect(settingsApi.createEventCategory).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });
});
