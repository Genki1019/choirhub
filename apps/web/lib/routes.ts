export type ConcertLinkSource = "home" | "schedule";

export function getConcertHref(org: string, concertId: string, from: ConcertLinkSource): string {
  const tab = from === "schedule" ? "survey" : "stages";
  return `/${org}/concerts/${concertId}?tab=${tab}&from=${from}`;
}
