export const SETTINGS_NAV_ITEMS = [
  { label: "団体情報", suffix: "" },
  { label: "パート管理", suffix: "/parts" },
  { label: "会費設定", suffix: "/fee" },
  { label: "支出カテゴリ", suffix: "/expense-categories" },
  { label: "メンバー区分", suffix: "/member-types" },
  { label: "イベント区分", suffix: "/event-categories" },
] as const;

export function settingsPageTitle(suffix: string): string {
  const item = SETTINGS_NAV_ITEMS.find((i) => i.suffix === suffix);
  if (!item) throw new Error(`Unknown settings suffix: ${suffix}`);
  return item.label;
}

export const SETTINGS_MAIN_CLASS_NAME = "mx-auto max-w-lg space-y-4";
