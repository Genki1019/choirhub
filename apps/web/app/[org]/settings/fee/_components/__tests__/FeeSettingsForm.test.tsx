import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeeSettingsForm } from "../FeeSettingsForm";
import { settingsApi } from "@/lib/settings-api";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      updateFee: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("FeeSettingsForm（表示）", () => {
  it("徴収方法を切り替えるとラベル・説明文が切り替わる", async () => {
    const user = userEvent.setup();
    render(<FeeSettingsForm orgSlug="o" initialFeeType="per_rehearsal" initialAmount="300" />);

    expect(screen.getByText("1回あたりの場所代（円）")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/^月額制/));
    expect(screen.getByText("月額会費（円）")).toBeInTheDocument();
  });
});

describe("FeeSettingsForm（保存）", () => {
  it("保存するとsettingsApi.updateFeeが呼ばれ「保存しました」が表示される", async () => {
    vi.mocked(settingsApi.updateFee).mockResolvedValue({
      feeType: "per_rehearsal",
      defaultFeeAmount: 500,
    });
    const user = userEvent.setup();
    render(<FeeSettingsForm orgSlug="o" initialFeeType="per_rehearsal" initialAmount="300" />);

    const amountInput = screen.getByPlaceholderText("例: 300");
    await user.clear(amountInput);
    await user.type(amountInput, "500");
    await user.click(screen.getByText("保存する"));

    expect(settingsApi.updateFee).toHaveBeenCalledWith("o", {
      feeType: "per_rehearsal",
      defaultFeeAmount: 500,
    });
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });

  it("金額を空欄にして保存するとdefaultFeeAmountがnullで送信される", async () => {
    vi.mocked(settingsApi.updateFee).mockResolvedValue({
      feeType: "per_rehearsal",
      defaultFeeAmount: null,
    });
    const user = userEvent.setup();
    render(<FeeSettingsForm orgSlug="o" initialFeeType="per_rehearsal" initialAmount="300" />);

    const amountInput = screen.getByPlaceholderText("例: 300");
    await user.clear(amountInput);
    await user.click(screen.getByText("保存する"));

    expect(settingsApi.updateFee).toHaveBeenCalledWith("o", {
      feeType: "per_rehearsal",
      defaultFeeAmount: null,
    });
  });

  it("保存の失敗が4xxならAPIの理由を読み上げる", async () => {
    vi.mocked(settingsApi.updateFee).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "入力値が不正です", 400),
    );
    const user = userEvent.setup();
    render(<FeeSettingsForm orgSlug="o" initialFeeType="per_rehearsal" initialAmount="300" />);

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByRole("alert")).toHaveTextContent("入力値が不正です");
  });

  it("保存の失敗が5xxなら代わりの文言を出す", async () => {
    vi.mocked(settingsApi.updateFee).mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    const user = userEvent.setup();
    render(<FeeSettingsForm orgSlug="o" initialFeeType="per_rehearsal" initialAmount="300" />);

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "会費設定の保存に失敗しました。もう一度お試しください。",
    );
  });

  it("保存中にもう一度押しても二重に送らず、ボタンは無効として読み上げる（フォーカスを外さない）", async () => {
    vi.mocked(settingsApi.updateFee).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<FeeSettingsForm orgSlug="o" initialFeeType="per_rehearsal" initialAmount="300" />);

    const button = screen.getByRole("button", { name: /保存する/ });
    await user.click(button);
    await user.click(button);

    expect(settingsApi.updateFee).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });
});
