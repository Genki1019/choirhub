export function formatCreators(composer: string | null, arranger: string | null): string | null {
  const parts: string[] = [];
  if (composer) parts.push(`${composer} 作曲`);
  if (arranger) parts.push(`${arranger} 編曲`);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function CreatorLine({
  composer,
  arranger,
}: {
  composer: string | null;
  arranger: string | null;
}) {
  const text = formatCreators(composer, arranger);
  if (!text) return null;
  return <p className="mt-0.5 text-xs text-gray-500">{text}</p>;
}
