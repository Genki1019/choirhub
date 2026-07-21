import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntroTemplateCard } from "../IntroTemplateCard";
import { settingsApi } from "@/lib/settings-api";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      getVisitorIntroTemplate: vi.fn(),
      updateVisitorIntroTemplate: vi.fn(),
    },
  };
});

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntroTemplateCard org="tokyo-men-choir" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("IntroTemplateCard", () => {
  it("現在のテンプレートを読み込んで表示する", async () => {
    vi.mocked(settingsApi.getVisitorIntroTemplate).mockResolvedValue({
      subjectTemplate: "見学者のご紹介",
      bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
      lineTemplate: "・{name}さん（希望パート: {part} / 出身団体: {origin}）",
    });
    renderCard();

    expect(await screen.findByDisplayValue("見学者のご紹介")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("・{name}さん（希望パート: {part} / 出身団体: {origin}）"),
    ).toBeInTheDocument();
  });

  it("プレビューにサンプルデータを展開した結果を表示する", async () => {
    vi.mocked(settingsApi.getVisitorIntroTemplate).mockResolvedValue({
      subjectTemplate: "見学者のご紹介",
      bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
      lineTemplate: "・{name}さん（希望パート: {part} / 出身団体: {origin}）",
    });
    renderCard();

    await screen.findByDisplayValue("見学者のご紹介");
    expect(
      screen.getByText(/・見学 太郎さん（希望パート: テノール \/ 出身団体: ○○大学グリークラブ）/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/・見学 花子さん（希望パート: 未定 \/ 出身団体: 未定）/),
    ).toBeInTheDocument();
  });

  it("編集して保存すると更新APIが呼ばれる", async () => {
    vi.mocked(settingsApi.getVisitorIntroTemplate).mockResolvedValue({
      subjectTemplate: "見学者のご紹介",
      bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
      lineTemplate: "・{name}さん（希望パート: {part} / 出身団体: {origin}）",
    });
    vi.mocked(settingsApi.updateVisitorIntroTemplate).mockResolvedValue({
      subjectTemplate: "新入団希望者のお知らせ",
      bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
      lineTemplate: "・{name}さん（希望パート: {part} / 出身団体: {origin}）",
    });
    const user = userEvent.setup();
    renderCard();

    const subjectInput = await screen.findByDisplayValue("見学者のご紹介");
    await user.clear(subjectInput);
    await user.type(subjectInput, "新入団希望者のお知らせ");
    await user.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(settingsApi.updateVisitorIntroTemplate).toHaveBeenCalledWith("tokyo-men-choir", {
        subjectTemplate: "新入団希望者のお知らせ",
        bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
        lineTemplate: "・{name}さん（希望パート: {part} / 出身団体: {origin}）",
      });
    });
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });

  it("「デフォルトに戻す」でデフォルトのテンプレートに戻る（保存はされない）", async () => {
    vi.mocked(settingsApi.getVisitorIntroTemplate).mockResolvedValue({
      subjectTemplate: "カスタム件名",
      bodyTemplate: "カスタム本文\n{lines}",
      lineTemplate: "{name}のみ",
    });
    const user = userEvent.setup();
    renderCard();

    await screen.findByDisplayValue("カスタム件名");
    await user.click(screen.getByText("デフォルトに戻す"));

    expect(screen.getByDisplayValue("見学者のご紹介")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("・{name}さん（希望パート: {part} / 出身団体: {origin}）"),
    ).toBeInTheDocument();
    expect(settingsApi.updateVisitorIntroTemplate).not.toHaveBeenCalled();
  });
});
