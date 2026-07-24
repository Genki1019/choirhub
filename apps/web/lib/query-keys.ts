export const homeKeys = {
  get: (org: string) => ["home", org] as const,
};

export const memberKeys = {
  list: (org: string) => ["members", org] as const,
  activeList: (org: string) => ["members", org, "active"] as const,
  detail: (org: string, id: string) => ["member", org, id] as const,
  parts: (org: string) => ["parts", org] as const,
  types: (org: string) => ["memberTypes", org] as const,
};

export const visitorApplicationKeys = {
  pending: (org: string) => ["visitorApplications", org, "pending"] as const,
};

export const eventKeys = {
  list: (org: string, year: number, month: number) => ["events", org, year, month] as const,
  detail: (org: string, id: string) => ["event", org, id] as const,
  categories: (org: string) => ["eventCategories", org] as const,
  calendarFeedToken: (org: string) => ["events", org, "calendarFeedToken"] as const,
};

export const scoresKeys = {
  grouped: (org: string) => ["scores", org, "grouped"] as const,
  detail: (org: string, id: string) => ["score", org, id] as const,
  list: (org: string, q: string) => ["scores", org, "list", q] as const,
};

export const concertKeys = {
  list: (org: string) => ["concerts", org] as const,
  detail: (org: string, id: string) => ["concert", org, id] as const,
};

export const mailingKeys = {
  all: (org: string) => ["mails", org] as const,
  list: (org: string, page: number) => ["mails", org, page] as const,
  detail: (org: string, id: string) => ["mail", org, id] as const,
};

export const settingsKeys = {
  org: (org: string) => ["settings", org, "org"] as const,
  fee: (org: string) => ["settings", org, "fee"] as const,
  expenseCategories: (org: string) => ["settings", org, "expenseCategories"] as const,
  visitorWebhook: (org: string) => ["settings", org, "visitorWebhook"] as const,
  visitorIntroTemplate: (org: string) => ["settings", org, "visitorIntroTemplate"] as const,
};

export const accountingKeys = {
  all: (org: string) => ["accounting", org] as const,
  summary: (org: string, year: number) => ["accounting", org, "summary", year] as const,
  expenses: (org: string, year: number) => ["accounting", org, "expenses", year] as const,
  collections: (org: string, year: number) => ["accounting", org, "collections", year] as const,
  collection: (org: string, id: string) => ["accounting", org, "collection", id] as const,
};

export const ticketKeys = {
  all: (org: string) => ["tickets", org] as const,
  list: (org: string) => ["tickets", org, "list"] as const,
  myList: (org: string) => ["tickets", org, "my"] as const,
  detail: (org: string, concertId: string) => ["tickets", org, "detail", concertId] as const,
  outreach: (org: string, concertId: string) => ["tickets", org, "outreach", concertId] as const,
  race: (org: string, concertId: string) => ["tickets", org, "race", concertId] as const,
};
