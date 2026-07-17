import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("追加に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(settingsApi.createEventCategory).mockRejectedValue(new Error("重複するカテゴリです"));
    const user = userEvent.setup();
    render(<AddCategoryForm org="o" onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("区分名"), "練習");
    await user.click(screen.getByText("追加"));

    expect(await screen.findByText("重複するカテゴリです")).toBeInTheDocument();
  });
});
