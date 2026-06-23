import { NextRequest } from "next/server";

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  mapUrl: string;
}

interface GooglePrediction {
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

interface NominatimResult {
  place_id: number;
  name: string;
  display_name: string;
  lat: string;
  lon: string;
}

async function searchGoogle(query: string, apiKey: string): Promise<PlaceResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "ja");
  url.searchParams.set("components", "country:jp");
  url.searchParams.set("types", "establishment|geocode");

  const res = await fetch(url.toString());
  const data = (await res.json()) as { status: string; predictions: GooglePrediction[] };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];

  return (data.predictions ?? []).map((p) => ({
    id: p.place_id,
    name: p.structured_formatting.main_text,
    address: p.structured_formatting.secondary_text ?? "",
    mapUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
  }));
}

async function searchNominatim(query: string): Promise<PlaceResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "ja");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "ChoirHub/1.0 (portfolio)",
      Accept: "application/json",
    },
  });
  const data = (await res.json()) as NominatimResult[];

  return data.map((p) => {
    const parts = p.display_name.split(",").map((s) => s.trim());
    const name = p.name || parts[0];
    const address = parts.slice(1, 4).filter(Boolean).join(", ");
    return {
      id: String(p.place_id),
      name,
      address,
      mapUrl: `https://www.google.com/maps?q=${p.lat},${p.lon}`,
    };
  });
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  if (query.length < 2) return Response.json({ results: [] });

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const results = apiKey
      ? await searchGoogle(query, apiKey)
      : await searchNominatim(query);

    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
