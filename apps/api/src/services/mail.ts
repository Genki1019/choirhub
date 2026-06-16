import { Resend } from "resend";
import { logger } from "../lib/logger.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FRONTEND_URL   = process.env.FRONTEND_URL   ?? "http://localhost:3000";
const FROM_ADDRESS   = process.env.MAIL_FROM      ?? "ChoirHub <onboarding@resend.dev>";

// DEV_MAIL_TO が設定されている場合、すべてのメールをそのアドレスに転送する（開発用）
const DEV_MAIL_TO = process.env.DEV_MAIL_TO ?? "";

const isDev = FRONTEND_URL.includes("localhost");

function isResendConfigured(): boolean {
  return RESEND_API_KEY.startsWith("re_") && RESEND_API_KEY.length > 10 && !RESEND_API_KEY.includes("xxx");
}

function buildInviteHtml(params: {
  greeting: string;
  orgName: string;
  inviteUrl: string;
  expiresLabel: string;
  devNotice?: string;
}): string {
  const { greeting, orgName, inviteUrl, expiresLabel, devNotice } = params;
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${orgName} への招待</title>
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

          ${devNotice ? `
          <!-- 開発用注記 -->
          <tr>
            <td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;">
              <p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${devNotice}</p>
            </td>
          </tr>` : ""}

          <!-- 本文 -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;">
                <strong>${orgName}</strong> からChoirHubへの招待が届いています。<br />
                下のボタンからパスワードを設定して、利用を開始してください。
              </p>

              <!-- ボタン -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#2563eb;border-radius:10px;">
                    <a href="${inviteUrl}"
                       style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      パスワードを設定する
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
  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:24px 40px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${orgName}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#bfdbfe;">ChoirHub</p>
        </td></tr>
        ${devNotice ? `<tr><td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;"><p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${devNotice}</p></td></tr>` : ""}
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#111827;">${subject}</p>
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
          ${devNotice ? `<tr><td style="background:#fef3c7;padding:12px 40px;border-bottom:1px solid #fde68a;"><p style="margin:0;font-size:12px;color:#92400e;">🔧 開発環境テスト送信 — ${devNotice}</p></td></tr>` : ""}
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">${nameJa} さん</p>
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

  const resetUrl    = `${FRONTEND_URL}/password-reset/${resetToken}`;
  const expiresLabel = expiresAt.toLocaleString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!isResendConfigured()) {
    logger.info("─────────────────────────────────────────────");
    logger.info("[mail] RESEND_API_KEY 未設定 — コンソールにフォールバック");
    logger.info(`[mail] 宛先       : ${to}`);
    logger.info(`[mail] リセットURL: ${resetUrl}`);
    logger.info(`[mail] 有効期限   : ${expiresLabel}`);
    logger.info("─────────────────────────────────────────────");
    return;
  }

  const actualTo  = DEV_MAIL_TO || to;
  const devNotice = (DEV_MAIL_TO && DEV_MAIL_TO !== to) ? `本来の宛先: ${to}` : undefined;

  const html = buildPasswordResetHtml({ nameJa, resetUrl, expiresLabel, devNotice });

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      actualTo,
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

  const devNotice = DEV_MAIL_TO
    ? `本来の宛先 ${to.length}名: ${to.map((t) => t.email).join(", ")}`
    : undefined;
  const html = buildBulkMailHtml({ orgName, subject, body, devNotice });
  const recipients = DEV_MAIL_TO ? [{ email: DEV_MAIL_TO }] : to;

  const resend = new Resend(RESEND_API_KEY);
  const { data, error } = await resend.batch.send(
    recipients.map((r) => ({ from: FROM_ADDRESS, to: r.email, subject, html })),
  );

  if (error) {
    logger.error("[mail] Resend batch error:", error);
    throw new Error(`メール送信に失敗しました: ${(error as { message?: string }).message ?? String(error)}`);
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

export async function sendInviteEmail(params: {
  to: string;
  nameJa: string | null;
  orgName: string;
  inviteToken: string;
  expiresAt: Date;
}): Promise<void> {
  const { to, nameJa, orgName, inviteToken, expiresAt } = params;

  const inviteUrl    = `${FRONTEND_URL}/invite/${inviteToken}`;
  const expiresLabel = expiresAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const greeting     = nameJa ? `${nameJa} さん` : "はじめまして";

  if (!isResendConfigured()) {
    logger.info("─────────────────────────────────────────────");
    logger.info("[mail] RESEND_API_KEY 未設定 — コンソールにフォールバック");
    logger.info(`[mail] 宛先     : ${to}`);
    logger.info(`[mail] 招待URL  : ${inviteUrl}`);
    logger.info(`[mail] 有効期限 : ${expiresLabel}`);
    logger.info("─────────────────────────────────────────────");
    return;
  }

  const actualTo  = DEV_MAIL_TO || to;
  const devNotice = (DEV_MAIL_TO && DEV_MAIL_TO !== to) ? `本来の宛先: ${to}` : undefined;

  const html = buildInviteHtml({ greeting, orgName, inviteUrl, expiresLabel, devNotice });

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to:   actualTo,
    subject: `【ChoirHub】${orgName} への招待`,
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
