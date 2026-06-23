import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ org: string; scoreId: string; fileId: string }> }
) {
  const { org, scoreId, fileId } = await params;

  const upstream = await fetch(
    `${API_INTERNAL_URL}/api/v1/${org}/scores/${scoreId}/files/${fileId}/download`,
    { headers: { Cookie: request.headers.get("cookie") ?? "" } }
  ).catch(() => null);

  if (!upstream || !upstream.ok) notFound();

  const ALLOWED_CONTENT_TYPES = new Set([
    "application/pdf",
    "audio/midi",
    "audio/mpeg",
    "audio/wav",
    "application/octet-stream",
  ]);
  const rawType = upstream.headers.get("Content-Type") ?? "";
  const contentType = ALLOWED_CONTENT_TYPES.has(rawType) ? rawType : "application/octet-stream";

  const contentDisposition = upstream.headers.get("Content-Disposition") ?? "attachment";

  return new Response(upstream.body, {
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control":       "private, max-age=3600",
    },
  });
}
