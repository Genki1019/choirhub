import { z } from "zod";
import { SLUG_REGEX } from "./slug";
import { PART_TEMPLATE_OPTIONS, type PartTemplateKey } from "./org-applications-api";

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const inviteAcceptSchema = z
  .object({
    nameJa: z.string().min(1, "お名前を入力してください"),
    password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "パスワードが一致しません",
    path: ["passwordConfirm"],
  });

export const inviteAcceptExistingUserSchema = z.object({
  password: z.string().min(1, "パスワードを入力してください"),
});

export const inviteMemberSchema = z.object({
  nameJa: z.string().optional(),
  email: z.string().email("有効なメールアドレスを入力してください"),
  partId: z.string().optional(),
  roles: z.array(z.string()).min(1, "ロールを1つ以上選択してください"),
});

export const addVisitorApplicationSchema = z.object({
  name: z.string().min(1, "お名前を入力してください"),
  partHope: z.string().optional(),
  originGroup: z.string().optional(),
  contact: z.string().optional(),
  message: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

export const passwordResetConfirmSchema = z
  .object({
    password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "パスワードが一致しません",
    path: ["passwordConfirm"],
  });

export const orgApplicationSchema = z.object({
  orgName: z.string().min(1, "団体名を入力してください").max(100),
  slug: z
    .string()
    .regex(SLUG_REGEX, "スラグは2〜50文字の英小文字・数字・ハイフンで入力してください"),
  templateKey: z.enum(
    PART_TEMPLATE_OPTIONS.map((opt) => opt.key) as [PartTemplateKey, ...PartTemplateKey[]],
  ),
  applicantName: z.string().min(1, "管理者氏名を入力してください").max(100),
  applicantEmail: z.string().email("有効なメールアドレスを入力してください"),
  message: z.string().max(1000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
export type InviteAcceptExistingUserInput = z.infer<typeof inviteAcceptExistingUserSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AddVisitorApplicationInput = z.infer<typeof addVisitorApplicationSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type OrgApplicationInput = z.infer<typeof orgApplicationSchema>;
