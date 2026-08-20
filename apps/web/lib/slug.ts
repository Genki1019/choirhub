export const SLUG_REGEX = /^[a-z0-9-]{2,50}$/;

export function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}
