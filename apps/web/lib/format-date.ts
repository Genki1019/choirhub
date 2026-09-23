// 当日は時刻、7日以内は「n日前」、それ以外は年/月/日で表示する
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (days < 7) return `${days}日前`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
