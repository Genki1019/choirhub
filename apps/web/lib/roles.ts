export const ROLES = [
  {
    key: "admin",
    defaultName: "最高管理者",
    description: "全権限",
    badgeClass: "bg-gray-800 text-white",
  },
  {
    key: "tech",
    defaultName: "技術系",
    description: "選曲・スケジュール・ステージ構成",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  {
    key: "conductor",
    defaultName: "指揮者",
    description: "選曲・スケジュール・ステージ構成（技術系と同権限）",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  {
    key: "score",
    defaultName: "楽譜がかり",
    description: "楽譜管理・アップロード",
    badgeClass: "bg-teal-100 text-teal-700",
  },
  {
    key: "ticket",
    defaultName: "チケット担当",
    description: "チケット配布・集計管理",
    badgeClass: "bg-orange-100 text-orange-700",
  },
  {
    key: "finance",
    defaultName: "会計",
    description: "支出・場所代支払い管理",
    badgeClass: "bg-purple-100 text-purple-700",
  },
  {
    key: "member",
    defaultName: "一般",
    description: "閲覧・出欠回答",
    badgeClass: "bg-gray-100 text-gray-600",
  },
  {
    key: "guest",
    defaultName: "客演",
    description: "スケジュール・楽譜閲覧・出欠",
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  {
    key: "visitor",
    defaultName: "体験",
    description: "共有アカウント / 全楽譜PDF閲覧可（MIDI不可）",
    badgeClass: "bg-red-50 text-red-500",
  },
] as const;

/** key → 日本語表示名（string でアクセス可） */
export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.key, r.defaultName]),
);

/** key → バッジスタイル（ラベル + Tailwind クラス）（string でアクセス可） */
export const ROLE_BADGE_STYLES: Record<string, { label: string; className: string }> =
  Object.fromEntries(ROLES.map((r) => [r.key, { label: r.defaultName, className: r.badgeClass }]));

/** member 以上のアクセス権を持つロール（hierarchy >= 40）。価格表示・出欠閲覧などの判定に使用 */
export const MEMBER_LEVEL_ROLES = new Set<string>(
  ROLES.filter((r) => r.key !== "guest" && r.key !== "visitor").map((r) => r.key),
);

/** 管理者がロール変更パネルで操作できる全ロール */
export const MANAGEABLE_ROLES = ROLES.map((r) => ({ value: r.key, label: r.defaultName }));

/** 招待モーダル・フィルターで使用するロール全件オプション */
export const ROLE_OPTIONS = ROLES.map((r) => ({ value: r.key, label: r.defaultName }));

/** スケジュール・イベント作成・編集の権限（admin / tech） */
export const canManageSchedule = (roles: string[]): boolean =>
  roles.includes("admin") || roles.includes("tech");

/** 設定画面・財務画面へのアクセス権限（admin / finance） */
export const canAccessSettings = (roles: string[]): boolean =>
  roles.includes("admin") || roles.includes("finance");
