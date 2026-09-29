import { ROLE_LABELS } from "./roles";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "./accounting-api";
import type { AuditCategory, AuditValue } from "./audit-logs-api";

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  access: "権限・所属",
  org: "団体設定",
  export: "データ持ち出し",
  finance: "会計",
};

export const AUDIT_CATEGORY_BADGE_CLASS: Record<AuditCategory, string> = {
  access: "bg-blue-50 text-blue-600",
  org: "bg-red-50 text-red-600",
  export: "bg-amber-50 text-amber-700",
  finance: "bg-emerald-50 text-emerald-700",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "member.invited": "メンバー招待",
  "member.roles_changed": "ロール変更",
  "member.status_changed": "在団状態変更",
  "member.email_changed": "メールアドレス変更",
  "member.removed": "退団処理",
  "org.renamed": "団体名変更",
  "org.deleted": "団体削除",
  "org.restored": "団体復元",
  "org.visitor_webhook_regenerated": "見学申込URL再発行",
  "members.exported": "名簿CSV出力",
  "expenses.exported": "支出CSV出力",
  "collections.exported": "徴収CSV出力",
  "payments.exported": "支払い記録CSV出力",
  "ticket_sales.exported": "チケット販売実績CSV出力",
  "audit_logs.exported": "操作履歴CSV出力",
  "expense.created": "支出登録",
  "expense.updated": "支出編集",
  "expense.deleted": "支出削除",
  "collection.created": "徴収作成",
  "collection.updated": "徴収編集",
  "collection.deleted": "徴収削除",
  "payment.changed": "支払い記録変更",
};

const FIELD_LABEL: Record<string, string> = {
  roles: "ロール",
  status: "状態",
  email: "メールアドレス",
  name: "団体名",
  category: "カテゴリ",
  title: "件名",
  amount: "金額",
  paymentMethod: "支払方法",
  method: "支払方法",
  paidAt: "支払日",
  dueDate: "締切日",
  yearMonth: "対象年月",
  note: "メモ",
  members: "対象者",
};

const MEMBER_STATUS_LABEL: Record<string, string> = { active: "在団", offstage: "休団" };
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "未払い",
  paid: "支払済",
  waived: "免除",
};

export function auditFieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

export function formatAuditValue(action: string, field: string, value: AuditValue): string {
  if (value === null || value === "") return "—";
  if (Array.isArray(value)) {
    return value.map((v) => formatAuditValue(action, field, v)).join("、");
  }
  if (field === "roles" && typeof value === "string") return ROLE_LABELS[value] ?? value;
  if (field === "amount" && typeof value === "number") return `¥${value.toLocaleString()}`;
  if (field === "members" && typeof value === "number") return `${value}名`;
  if ((field === "paymentMethod" || field === "method") && typeof value === "string") {
    return PAYMENT_METHOD_LABEL[value as PaymentMethod] ?? value;
  }
  if (field === "status" && typeof value === "string") {
    const labels = action.startsWith("member.") ? MEMBER_STATUS_LABEL : PAYMENT_STATUS_LABEL;
    return labels[value] ?? value;
  }
  return String(value);
}
