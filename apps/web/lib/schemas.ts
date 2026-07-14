import { z } from "zod";

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

export const inviteMemberSchema = z.object({
  nameJa: z.string().optional(),
  email: z.string().email("有効なメールアドレスを入力してください"),
  partId: z.string().optional(),
  roles: z.array(z.string()).min(1, "ロールを1つ以上選択してください"),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
