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
  const [open, setOpen]               = useState(false);
  const [searching, setSearching]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }

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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder-gray-300"
        />
        {searching && (
          <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}

        {/* サジェストドロップダウン — z-[200] で確実に前面へ */}
        {open && suggestions.length > 0 && (
          <div className="absolute z-[200] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {suggestions.map((place) => (
              <button
                key={place.id}
                type="button"
                onMouseDown={() => handleSelect(place)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-brand-50 border-b border-gray-100 last:border-0 transition-colors"
              >
                <MapPin size={14} className="text-brand-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{place.name}</p>
                  {place.address && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{place.address}</p>
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
          className="inline-flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
        >
          <ExternalLink size={11} />
          Google マップで開く
        </a>
      )}
    </div>
  );
}
