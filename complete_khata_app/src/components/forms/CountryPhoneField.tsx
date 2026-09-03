"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { COUNTRY_CODES } from "@/data/country-codes";

type Country = (typeof COUNTRY_CODES)[number];

const DEFAULT_COUNTRY = COUNTRY_CODES.find((country) => country.iso === "PK") ?? COUNTRY_CODES[0];

function parsePhone(phone: string) {
  if (!phone.startsWith("+")) return { country: DEFAULT_COUNTRY, digits: phone };

  const raw = phone.slice(1);
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

  for (const country of sorted) {
    if (raw.startsWith(country.code)) {
      return { country, digits: raw.slice(country.code.length) };
    }
  }

  return { country: DEFAULT_COUNTRY, digits: raw };
}

function CountryPicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (country: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () =>
      search
        ? COUNTRY_CODES.filter(
            (country) =>
              country.name.toLowerCase().includes(search.toLowerCase()) ||
              country.code.includes(search)
          )
        : COUNTRY_CODES,
    [search]
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((state) => !state);
          setSearch("");
        }}
        className="flex h-full w-full items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-44"
      >
        <span className="text-base">{value.flag}</span>
        <span className="flex-1 text-left">+{value.code}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search country or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-7 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-center text-sm text-gray-400">No results</li>
            ) : (
              filtered.map((country) => (
                <li key={country.iso}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(country);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 hover:text-blue-700 ${
                      country.iso === value.iso ? "bg-blue-50 font-medium text-blue-700" : "text-gray-700"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-base">{country.flag}</span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="shrink-0 text-gray-400">+{country.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface CountryPhoneFieldProps {
  label?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function CountryPhoneField({
  label = "Phone",
  required = false,
  defaultValue = "",
  error,
  placeholder = "3001234567",
  onChange,
}: CountryPhoneFieldProps) {
  const parsed = useMemo(() => parsePhone(defaultValue), [defaultValue]);
  const [selectedCountry, setSelectedCountry] = useState<Country>(parsed.country);
  const [phoneDigits, setPhoneDigits] = useState(parsed.digits);

  function updatePhoneField(country: Country, digits: string) {
    onChange(digits ? `+${country.code}${digits}` : "");
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <CountryPicker
          value={selectedCountry}
          onChange={(country) => {
            setSelectedCountry(country);
            updatePhoneField(country, phoneDigits);
          }}
        />
        <input
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          value={phoneDigits}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setPhoneDigits(digits);
            updatePhoneField(selectedCountry, digits);
          }}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
