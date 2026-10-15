import { useState, useEffect } from "react";
import { RecordEntry } from "../lib/types";

const STORAGE_KEY = "chakki_records";

function readRecords(): RecordEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: RecordEntry[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((r) => ({ ...r, paymentType: r.paymentType ?? "cash" }))
      : [];
  } catch {
    return [];
  }
}

function persistRecords(list: RecordEntry[]) {
  const json = JSON.stringify(list);
  localStorage.setItem(STORAGE_KEY, json);
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: json }));
}

export function useRecords() {
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setRecords(readRecords());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setRecords(readRecords());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveRecords = (newRecords: RecordEntry[]) => {
    setRecords(newRecords);
    persistRecords(newRecords);
  };

  const addRecord = (record: Omit<RecordEntry, "id" | "createdAt" | "total">): RecordEntry => {
    if (!record.kg || record.kg <= 0) throw new Error("KG must be > 0");
    if (!record.rate || record.rate <= 0) throw new Error("Rate must be > 0");
    const total = Math.round(record.kg * record.rate * 100) / 100;
    const newRecord: RecordEntry = { ...record, id: crypto.randomUUID(), createdAt: Date.now(), total };
    const fresh = readRecords();
    saveRecords([...fresh, newRecord]);
    return newRecord;
  };

  const updateRecord = (id: string, updates: Partial<RecordEntry>) => {
    const fresh = readRecords();
    const newRecords = fresh.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...updates };
      if (updates.kg !== undefined || updates.rate !== undefined) {
        updated.total = Math.round(updated.kg * updated.rate * 100) / 100;
      }
      return updated;
    });
    saveRecords(newRecords);
  };

  const deleteRecord = (id: string) => {
    const fresh = readRecords();
    saveRecords(fresh.filter((r) => r.id !== id));
  };

  return { records, isLoaded, addRecord, updateRecord, deleteRecord };
}
