import { useState, useEffect } from "react";
import { RateSettings } from "@/lib/types";

const SETTINGS_KEY = "chakki_settings";

export const DEFAULT_RATES: RateSettings = {
  Gehu: 2,
  Makka: 3,
  Dal: 5,
  Besan: 5,
  Wata: 2,
};

function readRates(): RateSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_RATES, ...JSON.parse(stored) } : DEFAULT_RATES;
  } catch {
    return DEFAULT_RATES;
  }
}

export function useSettings() {
  const [rates, setRates] = useState<RateSettings>(DEFAULT_RATES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setRates(readRates());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== SETTINGS_KEY) return;
      setRates(readRates());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveRates = (newRates: RateSettings) => {
    setRates(newRates);
    const json = JSON.stringify(newRates);
    localStorage.setItem(SETTINGS_KEY, json);
    window.dispatchEvent(new StorageEvent("storage", { key: SETTINGS_KEY, newValue: json }));
  };

  const updateRate = (anaj: string, rate: number) => {
    saveRates({ ...readRates(), [anaj]: rate });
  };

  return { rates, isLoaded, updateRate, saveRates };
}
