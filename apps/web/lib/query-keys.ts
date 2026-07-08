export const memberKeys = {
  list:       (org: string)             => ["members",     org]           as const,
  activeList: (org: string)             => ["members",     org, "active"] as const,
  detail:     (org: string, id: string) => ["member",      org, id]       as const,
  parts:      (org: string)             => ["parts",       org]           as const,
  types:      (org: string)             => ["memberTypes", org]           as const,
};

export const eventKeys = {
  list:       (org: string, year: number, month: number) => ["events",          org, year, month] as const,
  detail:     (org: string, id: string)                  => ["event",           org, id]          as const,
  categories: (org: string)                              => ["eventCategories", org]              as const,
};

export const concertKeys = {
  list:   (org: string)             => ["concerts", org]     as const,
  detail: (org: string, id: string) => ["concert",  org, id] as const,
};

export const scoresKeys = {
  grouped: (org: string)             => ["scores", org, "grouped"] as const,
  detail:  (org: string, id: string) => ["score",  org, id]        as const,
};

export const mailingKeys = {
  all:    (org: string)               => ["mails", org]       as const,
  list:   (org: string, page: number) => ["mails", org, page] as const,
  detail: (org: string, id: string)   => ["mail",  org, id]   as const,
};
