"use client";

import { useState, useRef } from "react";
import { Loader2, MapPin, ExternalLink } from "lucide-react";

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  mapUrl: string;
}

interface Props {
  value: string;
  mapUrl?: string;
  placeholder?: string;
  onChangeName: (name: string) => void;
  onSelectPlace: (name: string, url: string) => void;
}

export function LocationSearch({ value, mapUrl, placeholder, onChangeName, onSelectPlace }: Props) {
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: PlaceResult[] };
        setSuggestions(data.results);
        setOpen(data.results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleChange = (v: string) => {
    onChangeName(v);
    search(v);
  };

  const handleSelect = (place: PlaceResult) => {
    onSelectPlace(place.name, place.mapUrl);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* 場所名インプット */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? "場所を追加（例：○○文化センター 練習室3）"}
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
        />
        {searching && (
          <Loader2
            size={12}
            className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-gray-400"
          />
        )}

        {/* サジェストドロップダウン — z-[200] で確実に前面へ */}
        {open && suggestions.length > 0 && (
          <div className="absolute right-0 left-0 z-[200] mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            {suggestions.map((place) => (
              <button
                key={place.id}
                type="button"
                onMouseDown={() => handleSelect(place)}
                className="hover:bg-brand-50 flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0"
              >
                <MapPin size={14} className="text-brand-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{place.name}</p>
                  {place.address && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{place.address}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 地図リンクプレビュー */}
      {mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 bg-brand-50 border-brand-200 hover:bg-brand-100 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
        >
          <ExternalLink size={11} />
          Google マップで開く
        </a>
      )}
    </div>
  );
}
