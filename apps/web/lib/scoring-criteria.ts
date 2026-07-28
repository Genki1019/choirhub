import type { RacePartBreakdown, RaceScoringConfig } from "@/lib/tickets-api";

export const SCORING_CRITERIA = [
  { key: "avgSales", chipLabel: "平均販売", breakdownKey: "avgSalesPoints", hasSpeedFields: false },
  { key: "speed5", chipLabel: "速5枚", breakdownKey: "speed5Points", hasSpeedFields: true },
  { key: "speed10", chipLabel: "速10枚", breakdownKey: "speed10Points", hasSpeedFields: true },
  { key: "zeroRatio", chipLabel: "ゼロ率", breakdownKey: "zeroRatioPoints", hasSpeedFields: false },
  { key: "outreach", chipLabel: "情宣", breakdownKey: "outreachPoints", hasSpeedFields: false },
] as const satisfies ReadonlyArray<{
  key: keyof RaceScoringConfig;
  chipLabel: string;
  breakdownKey: keyof RacePartBreakdown;
  hasSpeedFields: boolean;
}>;
