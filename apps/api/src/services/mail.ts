import { Resend } from "resend";
import { logger } from "../lib/logger.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const FROM_ADDRESS = process.env.MAIL_FROM ?? "ChoirHub <onboarding@resend.dev>";

// DEV_MAIL_TO が設定されている場合、すべてのメールをそのアドレスに転送する（開発用）
const DEV_MAIL_TO = process.env.DEV_MAIL_TO ?? "";

function isResendConfigured(): boolean {
  return (
    RESEND_API_KEY.startsWith("re_") &&
    RESEND_API_KEY.length > 10 &&
    !RESEND_API_KEY.includes("xxx")
  );
}

// メールHTMLに埋め込む前にユーザー入力由来の文字列をエスケープする（XSS/HTML injection対策）
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 招待先が既存ユーザーかどうかで変わるメール文面（件名・本文・ボタン）の一元管理。
// buildInviteHtml と sendInviteEmail の両方から参照する。
function getInviteCopy(
  isExistingUser: boolean,
  orgName: string,
): { subject: string; bodyText: string; buttonLabel: string } {
  if (isExistingUser) {
    return {
      subject: `【ChoirHub】${orgName} への参加`,
      bodyText:
        "からChoirHubへの招待が届いています。<br />既にお使いのアカウントに追加されます。下のボタンから、現在お使いのパスワードでログインして参加を完了してください。",
      buttonLabel: "ログインして参加する",
    };
  }
  return {
    subject: `【ChoirHub】${orgName} への招待`,
    bodyText:
      "からChoirHubへの招待が届いています。<br />下のボタンからパスワードを設定して、利用を開始してください。",
    buttonLabel: "パスワードを設定する",
  };
}

function buildInviteHtml(params: {
  greeting: string;
  orgName: string;
  inviteUrl: string;
  expiresLabel: string;
  bodyText: string;
  buttonLabel: string;
  devNotice?: string;
}): string {
  const { greeting, orgName, inviteUrl, expiresLabel, bodyText, buttonLabel, devNotice } = params;
  const safeGreeting = escapeHtml(greeting);
  const safeOrgName = escapeHtml(orgName);
  const safeDevNotice = devNotice ? escapeHtml(devNotice) : undefined;
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeOrgName} への招待</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

          <!-- ヘッダー -->
          <tr>
            <td style="background:#2563eb;padding:28px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">ChoirHub</p>
              <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">合唱団運営支援サービス</p>
            </td>
          </tr>

          ${
            devNotice
              ? `
          <!-- 開発用注記 -->
          <tr>
            <td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;">
              <p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${safeDevNotice}</p>
            </td>
          </tr>`
              : ""
          }

          <!-- 本文 -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">${safeGreeting}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;">
                <strong>${safeOrgName}</strong> ${bodyText}
              </p>

              <!-- ボタン -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#2563eb;border-radius:10px;">
                    <a href="${inviteUrl}"
                       style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      ${buttonLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- URL 表示 -->
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">ボタンが表示されない場合は以下のURLをブラウザに貼り付けてください：</p>
              <p style="margin:0 0 28px;font-size:12px;color:#2563eb;word-break:break-all;">
                <a href="${inviteUrl}" style="color:#2563eb;">${inviteUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />

              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                このリンクの有効期限は <strong style="color:#6b7280;">${expiresLabel}</strong> です。<br />
                身に覚えのない場合はこのメールを無視してください。
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">
                © ChoirHub — 合唱団運営支援サービス
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function buildBulkMailHtml(params: {
  orgName: string;
  subject: string;
  body: string;
  devNotice?: string;
}): string {
  const { orgName, subject, body, devNotice } = params;
  const safeOrgName = escapeHtml(orgName);
  const safeSubject = escapeHtml(subject);
  const safeDevNotice = devNotice ? escapeHtml(devNotice) : undefined;
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:24px 40px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${safeOrgName}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#bfdbfe;">ChoirHub</p>
        </td></tr>
        ${safeDevNotice ? `<tr><td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;"><p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${safeDevNotice}</p></td></tr>` : ""}
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#111827;">${safeSubject}</p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">${htmlBody}</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">© ChoirHub — 合唱団運営支援サービス</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPasswordResetHtml(params: {
  nameJa: string;
  resetUrl: string;
  expiresLabel: string;
  devNotice?: string;
}): string {
  const { nameJa, resetUrl, expiresLabel, devNotice } = params;
  const safeNameJa = escapeHtml(nameJa);
  const safeDevNotice = devNotice ? escapeHtml(devNotice) : undefined;
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>パスワードのリセット</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#2563eb;padding:28px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">ChoirHub</p>
              <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">合唱団運営支援サービス</p>
            </td>
          </tr>
          ${safeDevNotice ? `<tr><td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;"><p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${safeDevNotice}</p></td></tr>` : ""}
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">${safeNameJa} さん</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;">
                パスワードのリセットをリクエストを受け付けました。<br />
                下のボタンから新しいパスワードを設定してください。
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#2563eb;border-radius:10px;">
                    <a href="${resetUrl}" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      パスワードを再設定する
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">ボタンが表示されない場合は以下のURLをブラウザに貼り付けてください：</p>
              <p style="margin:0 0 28px;font-size:12px;color:#2563eb;word-break:break-all;">
                <a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                このリンクの有効期限は <strong style="color:#6b7280;">${expiresLabel}</strong> です。<br />
                心当たりのない場合はこのメールを無視してください。パスワードは変更されません。
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">© ChoirHub — 合唱団運営支援サービス</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  nameJa: string;
  resetToken: string;
  expiresAt: Date;
}): Promise<void> {
  const { to, nameJa, resetToken, expiresAt } = params;

  const resetUrl = `${FRONTEND_URL}/password-reset/${resetToken}`;
  const expiresLabel = expiresAt.toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!isResendConfigured()) {
    logger.info("─────────────────────────────────────────────");
    logger.info("[mail] RESEND_API_KEY 未設定 — コンソールにフォールバック");
    logger.info(`[mail] 宛先       : ${to}`);
    logger.info(`[mail] リセットURL: ${resetUrl}`);
    logger.info(`[mail] 有効期限   : ${expiresLabel}`);
    logger.info("─────────────────────────────────────────────");
    return;
  }

  const actualTo = DEV_MAIL_TO || to;
  const devNotice = DEV_MAIL_TO && DEV_MAIL_TO !== to ? `本来の宛先: ${to}` : undefined;

  const html = buildPasswordResetHtml({ nameJa, resetUrl, expiresLabel, devNotice });

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: actualTo,
    subject: "【ChoirHub】パスワードのリセット",
    html,
  });

  if (error) {
    logger.error("[mail] Resend error:", error);
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }

  logger.info("[mail] password reset sent to", actualTo, "via Resend");
}

export async function sendBulkMail(params: {
  to: { email: string }[];
  subject: string;
  body: string;
  orgName: string;
}): Promise<string[]> {
  const { to, subject, body, orgName } = params;

  if (!isResendConfigured()) {
    logger.info("─────────────────────────────────────────────");
    logger.info("[mail] RESEND_API_KEY 未設定 — コンソールにフォールバック");
    logger.info(`[mail] 件名    : ${subject}`);
    logger.info(`[mail] 宛先(${to.length}名): ${to.map((t) => t.email).join(", ")}`);
    logger.info(`[mail] 本文    :\n${body}`);
    logger.info("─────────────────────────────────────────────");
    return [];
  }

  logger.info(`[mail] DEV_MAIL_TO="${DEV_MAIL_TO || "(未設定)"}"`);

  const devNotice = DEV_MAIL_TO
    ? `本来の宛先 ${to.length}名: ${to.map((t) => t.email).join(", ")}`
    : undefined;
  const html = buildBulkMailHtml({ orgName, subject, body, devNotice });
  const recipients = DEV_MAIL_TO ? [{ email: DEV_MAIL_TO }] : to;
  logger.info(`[mail] 送信先: ${recipients.map((r) => r.email).join(", ")}`);

  const resend = new Resend(RESEND_API_KEY);
  const { data, error } = await resend.batch.send(
    recipients.map((r) => ({ from: FROM_ADDRESS, to: r.email, subject, html })),
  );

  if (error) {
    logger.error("[mail] Resend batch error:", error);
    throw new Error(
      `メール送信に失敗しました: ${(error as { message?: string }).message ?? String(error)}`,
    );
  }

  const ids = data?.data?.map((d) => d.id) ?? [];
  logger.info(`[mail] bulk sent: "${subject}" to ${to.length} recipients (ids: ${ids.join(", ")})`);
  return ids;
}

export interface ResendEmail {
  id: string;
  to: string[];
  from: string;
  subject: string;
  created_at: string;
  last_event: string;
  html: string | null;
  text: string | null;
}

export async function getResendEmail(emailId: string): Promise<ResendEmail | null> {
  if (!isResendConfigured()) return null;
  try {
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.get(emailId);
    if (error || !data) {
      logger.warn(`[mail] getResendEmail(${emailId}):`, error);
      return null;
    }
    return data as unknown as ResendEmail;
  } catch (e) {
    logger.warn(`[mail] getResendEmail(${emailId}) threw:`, e);
    return null;
  }
}

// 招待先メールアドレスが既存ユーザーかどうかで、送信するメールの表示名と文面を出し分けるための解決処理。
// members.ts / org-applications.ts の両方から呼ばれる共通ロジック。
export function resolveInviteRecipient(
  existingUser: { nameJa: string } | null,
  fallbackNameJa?: string | null,
): { nameJa: string | null; isExistingUser: boolean } {
  return {
    nameJa: existingUser?.nameJa ?? fallbackNameJa ?? null,
    isExistingUser: existingUser !== null,
  };
}

export async function sendInviteEmail(params: {
  to: string;
  nameJa: string | null;
  orgName: string;
  inviteToken: string;
  expiresAt: Date;
  isExistingUser: boolean;
}): Promise<void> {
  const { to, nameJa, orgName, inviteToken, expiresAt, isExistingUser } = params;

  const inviteUrl = `${FRONTEND_URL}/invite/${inviteToken}`;
  const expiresLabel = expiresAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const greeting = nameJa ? `${nameJa} さん` : "はじめまして";

  if (!isResendConfigured()) {
    logger.info("─────────────────────────────────────────────");
    logger.info("[mail] RESEND_API_KEY 未設定 — コンソールにフォールバック");
    logger.info(`[mail] 宛先     : ${to}`);
    logger.info(`[mail] 招待URL  : ${inviteUrl}`);
    logger.info(`[mail] 有効期限 : ${expiresLabel}`);
    logger.info("─────────────────────────────────────────────");
    return;
  }

  const actualTo = DEV_MAIL_TO || to;
  const devNotice = DEV_MAIL_TO && DEV_MAIL_TO !== to ? `本来の宛先: ${to}` : undefined;

  const { subject, bodyText, buttonLabel } = getInviteCopy(isExistingUser, orgName);
  const html = buildInviteHtml({
    greeting,
    orgName,
    inviteUrl,
    expiresLabel,
    bodyText,
    buttonLabel,
    devNotice,
  });

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: actualTo,
    subject,
    html,
  });

  if (error) {
    logger.error("[mail] Resend error:", error);
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }

  if (devNotice) {
    logger.info(`[mail] 開発転送: ${to} → ${actualTo}`);
  }
  logger.info("[mail] invite sent to", actualTo, "via Resend");
}

function buildOrgApplicationHtml(params: {
  applicantName: string;
  applicantEmail: string;
  orgName: string;
  message?: string;
  devNotice?: string;
}): string {
  const { applicantName, applicantEmail, orgName, message, devNotice } = params;
  const safeApplicantName = escapeHtml(applicantName);
  const safeApplicantEmail = escapeHtml(applicantEmail);
  const safeOrgName = escapeHtml(orgName);
  const safeMessage = message ? escapeHtml(message) : undefined;
  const safeDevNotice = devNotice ? escapeHtml(devNotice) : undefined;
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>団体作成の申請 — ${safeOrgName}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

          <!-- ヘッダー -->
          <tr>
            <td style="background:#2563eb;padding:28px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">ChoirHub</p>
              <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">合唱団運営支援サービス</p>
            </td>
          </tr>

          ${
            devNotice
              ? `
          <!-- 開発用注記 -->
          <tr>
            <td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;">
              <p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${safeDevNotice}</p>
            </td>
          </tr>`
              : ""
          }

          <!-- 本文 -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 24px;font-size:15px;color:#374151;">
                新しい団体作成の申請が届きました。
              </p>

              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#6b7280;width:96px;">団体名</td>
                  <td style="padding:4px 0;font-size:13px;color:#374151;font-weight:600;">${safeOrgName}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#6b7280;">申請者</td>
                  <td style="padding:4px 0;font-size:13px;color:#374151;">${safeApplicantName}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#6b7280;">メール</td>
                  <td style="padding:4px 0;font-size:13px;color:#374151;">${safeApplicantEmail}</td>
                </tr>
              </table>

              ${
                safeMessage
                  ? `
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">メッセージ：</p>
              <p style="margin:0 0 24px;font-size:13px;color:#374151;white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px 16px;">${safeMessage}</p>`
                  : ""
              }

              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />

              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                ChoirHub管理画面から団体を作成し、申請者へご連絡ください。
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">
                © ChoirHub — 合唱団運営支援サービス
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function sendOrgApplicationEmail(params: {
  to: string[];
  applicantName: string;
  applicantEmail: string;
  orgName: string;
  message?: string;
}): Promise<void> {
  const { to, applicantName, applicantEmail, orgName, message } = params;

  if (!isResendConfigured()) {
    logger.info("─────────────────────────────────────────────");
    logger.info("[mail] RESEND_API_KEY 未設定 — コンソールにフォールバック");
    logger.info(`[mail] 宛先     : ${to.join(", ")}`);
    logger.info(`[mail] 団体名   : ${orgName}`);
    logger.info(`[mail] 申請者   : ${applicantName} <${applicantEmail}>`);
    if (message) logger.info(`[mail] メッセージ: ${message}`);
    logger.info("─────────────────────────────────────────────");
    return;
  }

  const actualTo = DEV_MAIL_TO ? [DEV_MAIL_TO] : to;
  const devNotice = DEV_MAIL_TO ? `本来の宛先: ${to.join(", ")}` : undefined;

  const html = buildOrgApplicationHtml({
    applicantName,
    applicantEmail,
    orgName,
    message,
    devNotice,
  });

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: actualTo,
    subject: `【ChoirHub】団体作成の申請 — ${orgName}`,
    html,
  });

  if (error) {
    logger.error("[mail] Resend error:", error);
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }

  if (devNotice) {
    logger.info(`[mail] 開発転送: ${to.join(", ")} → ${actualTo.join(", ")}`);
  }
  logger.info("[mail] org application sent to", actualTo.join(", "), "via Resend");
}
