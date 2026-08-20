export function getSystemAdminEmails(): string[] {
  return (process.env.SYSTEM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSystemAdmin(email: string): boolean {
  return getSystemAdminEmails().includes(email.toLowerCase());
}
