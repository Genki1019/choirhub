export function CreatorLine({
  composer,
  arranger,
}: {
  composer: string | null;
  arranger: string | null;
}) {
  if (!composer && !arranger) return null;
  const parts: string[] = [];
  if (composer) parts.push(`${composer} 作曲`);
  if (arranger) parts.push(`${arranger} 編曲`);
  return <p className="mt-0.5 text-xs text-gray-500">{parts.join(" / ")}</p>;
}
