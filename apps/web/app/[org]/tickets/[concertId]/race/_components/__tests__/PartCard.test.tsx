import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartCard } from "../PartCard";
import { ticketsApi, type RacePart, type RaceScoringConfig } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: { saveOrganizerPeriod: vi.fn() },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

function makeScoring(overrides: Partial<RaceScoringConfig> = {}): RaceScoringConfig {
  return {
    avgSales: { label: "平均販売", enabled: true, points: [10, 6, 3] },
    speed5: { label: "速5枚", enabled: true, threshold: 5, minCount: 3, points: [10, 6, 3] },
    speed10: { label: "速10枚", enabled: true, threshold: 10, minCount: 3, points: [10, 6, 3] },
    zeroRatio: { label: "ゼロ率", enabled: true, points: [10, 6, 3] },
    outreach: { label: "情宣", enabled: true, points: [10, 6, 3] },
    ...overrides,
  };
}

function makePart(overrides: Partial<RacePart> = {}): RacePart {
  return {
    partId: "part-1",
    partName: "テノール1",
    rank: 1,
    totalPoints: 35,
    breakdown: {
      avgSalesPoints: 10,
      speed5Points: 6,
      speed10Points: 3,
      zeroRatioPoints: 10,
      outreachPoints: 6,
    },
    organizerPeriod: null,
    stats: {
      avgSold: 4.5,
      speed5AchievedAt: "2026-05-10T00:00:00+09:00",
      speed10AchievedAt: null,
      zeroSellerRatio: 0.1,
      totalOutreach: 8,
      memberCount: 5,
      allocated: 50,
      sold: 40,
    },
    ...overrides,
  };
}

// 幹事期間の編集操作を伴わないテストで毎回渡す必要のある固定props
const readOnlyProps = {
  isTicketManager: false,
  org: "tokyo-men-choir",
  concertId: "concert-1",
  onOrganizerPeriodSaved: () => {},
};

describe("PartCard（表示）", () => {
  it("パート名・合計ポイント・内訳・統計を表示する", () => {
    render(<PartCard part={makePart()} scoring={makeScoring()} {...readOnlyProps} />);

    expect(screen.getByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("平均4.5枚")).toBeInTheDocument();
    expect(screen.getByText("情宣8回")).toBeInTheDocument();
  });

  it("ポイントが0の内訳は打ち消し線で表示される", () => {
    render(
      <PartCard
        part={makePart({
          breakdown: {
            avgSalesPoints: 0,
            speed5Points: 6,
            speed10Points: 3,
            zeroRatioPoints: 10,
            outreachPoints: 6,
          },
        })}
        scoring={makeScoring()}
        {...readOnlyProps}
      />,
    );

    expect(screen.getByText("平均販売")).toHaveClass("line-through");
  });

  it("速達成日時がある場合は日付を表示する", () => {
    render(<PartCard part={makePart()} scoring={makeScoring()} {...readOnlyProps} />);

    expect(screen.getByText(/5枚×3名:/)).toBeInTheDocument();
    expect(screen.queryByText(/10枚×3名:/)).not.toBeInTheDocument();
  });

  it("無効化された基準はチップ非表示・maxPointsにも加算されない", () => {
    render(
      <PartCard
        part={makePart()}
        scoring={makeScoring({ outreach: { label: "情宣", enabled: false, points: [10, 6, 3] } })}
        {...readOnlyProps}
      />,
    );

    expect(screen.queryByText("情宣")).not.toBeInTheDocument();
    // maxPointsは10(avgSales)+10(speed5)+10(speed10)+10(zeroRatio) = 40（outreachの10は含まない）
    expect(screen.getByText("/40pt")).toBeInTheDocument();
  });
});

describe("PartCard（幹事期間）", () => {
  it("isTicketManagerがfalseかつ未設定の場合は幹事期間の行を表示しない", () => {
    render(<PartCard part={makePart()} scoring={makeScoring()} {...readOnlyProps} />);

    expect(screen.queryByText(/幹事期間/)).not.toBeInTheDocument();
  });

  it("isTicketManagerがfalseかつ設定済みの場合は編集ボタンなしで期間を表示する", () => {
    render(
      <PartCard
        part={makePart({ organizerPeriod: { fromMonth: "2026-04", toMonth: "2026-06" } })}
        scoring={makeScoring()}
        {...readOnlyProps}
      />,
    );

    expect(screen.getByText("幹事期間: 2026年4月〜2026年6月")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("isTicketManagerがtrueの場合は鉛筆アイコンから編集でき、保存するとAPIが呼ばれる", async () => {
    const year = String(new Date().getFullYear());
    vi.mocked(ticketsApi.saveOrganizerPeriod).mockResolvedValue({
      partId: "part-1",
      fromMonth: `${year}-04`,
      toMonth: `${year}-06`,
    });
    const user = userEvent.setup();
    const onOrganizerPeriodSaved = vi.fn();
    render(
      <PartCard
        part={makePart()}
        scoring={makeScoring()}
        isTicketManager={true}
        org="tokyo-men-choir"
        concertId="concert-1"
        onOrganizerPeriodSaved={onOrganizerPeriodSaved}
      />,
    );

    expect(screen.getByText("幹事期間: 未設定")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));

    await user.selectOptions(screen.getByLabelText("開始月（年）"), year);
    await user.selectOptions(screen.getByLabelText("開始月（月）"), "04");
    await user.selectOptions(screen.getByLabelText("終了月（年）"), year);
    await user.selectOptions(screen.getByLabelText("終了月（月）"), "06");
    await user.click(screen.getByLabelText("保存"));

    await waitFor(() => {
      expect(ticketsApi.saveOrganizerPeriod).toHaveBeenCalledWith(
        "tokyo-men-choir",
        "concert-1",
        "part-1",
        { fromMonth: `${year}-04`, toMonth: `${year}-06` },
      );
    });
    expect(onOrganizerPeriodSaved).toHaveBeenCalledWith("part-1", {
      fromMonth: `${year}-04`,
      toMonth: `${year}-06`,
    });
  });

  it("編集開始時、既存の期間がある場合はプルダウンに現在値がプレフィルされる", async () => {
    const user = userEvent.setup();
    render(
      <PartCard
        part={makePart({ organizerPeriod: { fromMonth: "2026-04", toMonth: "2026-06" } })}
        scoring={makeScoring()}
        isTicketManager={true}
        org="tokyo-men-choir"
        concertId="concert-1"
        onOrganizerPeriodSaved={() => {}}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByLabelText("開始月（年）")).toHaveValue("2026");
    expect(screen.getByLabelText("開始月（月）")).toHaveValue("04");
    expect(screen.getByLabelText("終了月（年）")).toHaveValue("2026");
    expect(screen.getByLabelText("終了月（月）")).toHaveValue("06");
  });

  it("キャンセルすると選択を破棄し編集モードを終了する（APIは呼ばれない）", async () => {
    const year = String(new Date().getFullYear());
    const user = userEvent.setup();
    render(
      <PartCard
        part={makePart()}
        scoring={makeScoring()}
        isTicketManager={true}
        org="tokyo-men-choir"
        concertId="concert-1"
        onOrganizerPeriodSaved={() => {}}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.selectOptions(screen.getByLabelText("開始月（年）"), year);
    await user.selectOptions(screen.getByLabelText("開始月（月）"), "04");
    await user.click(screen.getByLabelText("キャンセル"));

    expect(screen.getByText("幹事期間: 未設定")).toBeInTheDocument();
    expect(ticketsApi.saveOrganizerPeriod).not.toHaveBeenCalled();
  });

  it("設定済みの期間を両方未選択に戻して保存すると、nullで解除される", async () => {
    vi.mocked(ticketsApi.saveOrganizerPeriod).mockResolvedValue({
      partId: "part-1",
      fromMonth: null,
      toMonth: null,
    });
    const user = userEvent.setup();
    const onOrganizerPeriodSaved = vi.fn();
    render(
      <PartCard
        part={makePart({ organizerPeriod: { fromMonth: "2026-04", toMonth: "2026-06" } })}
        scoring={makeScoring()}
        isTicketManager={true}
        org="tokyo-men-choir"
        concertId="concert-1"
        onOrganizerPeriodSaved={onOrganizerPeriodSaved}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.selectOptions(screen.getByLabelText("開始月（年）"), "");
    await user.selectOptions(screen.getByLabelText("開始月（月）"), "");
    await user.selectOptions(screen.getByLabelText("終了月（年）"), "");
    await user.selectOptions(screen.getByLabelText("終了月（月）"), "");
    await user.click(screen.getByLabelText("保存"));

    await waitFor(() => {
      expect(ticketsApi.saveOrganizerPeriod).toHaveBeenCalledWith(
        "tokyo-men-choir",
        "concert-1",
        "part-1",
        null,
      );
    });
    expect(onOrganizerPeriodSaved).toHaveBeenCalledWith("part-1", null);
  });

  it("開始月のみ選択した状態では保存ボタンがdisabledになる", async () => {
    const year = String(new Date().getFullYear());
    const user = userEvent.setup();
    render(
      <PartCard
        part={makePart()}
        scoring={makeScoring()}
        isTicketManager={true}
        org="tokyo-men-choir"
        concertId="concert-1"
        onOrganizerPeriodSaved={() => {}}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.selectOptions(screen.getByLabelText("開始月（年）"), year);
    await user.selectOptions(screen.getByLabelText("開始月（月）"), "04");

    expect(screen.getByLabelText("保存")).toBeDisabled();
    expect(ticketsApi.saveOrganizerPeriod).not.toHaveBeenCalled();
  });

  it("終了月が開始月より前の場合は保存ボタンがdisabledになる", async () => {
    const year = String(new Date().getFullYear());
    const user = userEvent.setup();
    render(
      <PartCard
        part={makePart()}
        scoring={makeScoring()}
        isTicketManager={true}
        org="tokyo-men-choir"
        concertId="concert-1"
        onOrganizerPeriodSaved={() => {}}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.selectOptions(screen.getByLabelText("開始月（年）"), year);
    await user.selectOptions(screen.getByLabelText("開始月（月）"), "06");
    await user.selectOptions(screen.getByLabelText("終了月（年）"), year);
    await user.selectOptions(screen.getByLabelText("終了月（月）"), "04");

    expect(screen.getByLabelText("保存")).toBeDisabled();
  });
});
