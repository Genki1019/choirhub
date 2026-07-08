export const memberKeys = {
  list:   (org: string)             => ["members",     org]     as const,
  detail: (org: string, id: string) => ["member",      org, id] as const,
  parts:  (org: string)             => ["parts",       org]     as const,
  types:  (org: string)             => ["memberTypes", org]     as const,
};
