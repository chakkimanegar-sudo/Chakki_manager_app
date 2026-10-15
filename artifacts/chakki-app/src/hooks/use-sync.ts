import { useState, useEffect, useCallback, useRef } from "react";

const SHOP_CODE_KEY = "chakki_shop_code";
const LAST_SYNC_KEY = "chakki_last_sync";
const LAST_SERVER_AT_KEY = "chakki_last_server_at";
const LAST_SERVER_SNAPSHOT_KEY = "chakki_last_server_snapshot";

const API_BASE = "/api";

const LS_RECORDS = "chakki_records";
const LS_CUSTOMERS = "khata_customers";
const LS_TRANSACTIONS = "khata_transactions";
const LS_SETTINGS = "chakki_settings";

export type SyncStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "error"
  | "offline"
  | "not-setup";

type Snapshot = {
  records: unknown[];
  customers: unknown[];
  transactions: unknown[];
  settings: Record<string, number>;
};

type ServerResponse = Snapshot & {
  shopId: string;
  updatedAt: string;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key, json);
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: json }),
    );
  } catch {}
}

function getLocalSnapshot(): Snapshot {
  return {
    records: readJSON<unknown[]>(LS_RECORDS, []),
    customers: readJSON<unknown[]>(LS_CUSTOMERS, []),
    transactions: readJSON<unknown[]>(LS_TRANSACTIONS, []),
    settings: readJSON<Record<string, number>>(LS_SETTINGS, {}),
  };
}

function snapshotEquals(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeMobile(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Repair missing Khata links for older Udhar records. */
function reconcileKhataSnapshot(snapshot: Snapshot): Snapshot {
  const customers = [...snapshot.customers];
  const transactions = [...snapshot.transactions];
  let changed = false;

  for (const rawRecord of snapshot.records) {
    const record = asObject(rawRecord);
    if (!record || record.paymentType !== "udhar") continue;

    const recordId = typeof record.id === "string" ? record.id : "";
    const customerName = String(record.customerName ?? "").trim();

    if (
      !recordId ||
      !customerName ||
      transactions.some((rawTransaction) => asObject(rawTransaction)?.recordId === recordId)
    ) {
      continue;
    }

    const nameKey = normalizeName(customerName);
    const mobile = normalizeMobile(record.mobile);
    let customer = customers.map(asObject).find((candidate) => {
      if (!candidate) return false;
      const sameName = normalizeName(candidate.name) === nameKey;
      const candidateMobile = normalizeMobile(candidate.mobile);
      return sameName && (!mobile || candidateMobile === mobile);
    });

    if (!customer) {
      customer = {
        id: crypto.randomUUID(),
        name: customerName,
        mobile,
        village: String(record.village ?? "").trim(),
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
      };
      customers.push(customer);
      changed = true;
    }

    const customerId = typeof customer.id === "string" ? customer.id : "";
    if (!customerId) continue;

    const amount = typeof record.total === "number" ? record.total : Number(record.total);
    const kg = typeof record.kg === "number" ? record.kg : undefined;
    const anaj = typeof record.anaj === "string" ? record.anaj : undefined;
    const date = typeof record.date === "string" ? record.date : "";

    const matchingUnlinkedTransactionIndex = transactions.findIndex((rawTransaction) => {
      const transaction = asObject(rawTransaction);
      return (
        !!transaction &&
        transaction.type === "udhar" &&
        !transaction.recordId &&
        transaction.customerId === customerId &&
        transaction.amount === amount &&
        transaction.date === date &&
        transaction.kg === kg &&
        transaction.anaj === anaj
      );
    });

    if (matchingUnlinkedTransactionIndex >= 0) {
      const transaction = asObject(transactions[matchingUnlinkedTransactionIndex]);
      if (transaction) {
        transactions[matchingUnlinkedTransactionIndex] = { ...transaction, recordId };
        changed = true;
      }
      continue;
    }

    transactions.push({
      id: crypto.randomUUID(),
      customerId,
      type: "udhar",
      amount,
      anaj,
      kg,
      rate: typeof record.rate === "number" ? record.rate : undefined,
      date,
      notes: String(record.notes ?? ""),
      recordId,
      createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    });
    changed = true;
  }

  return changed ? { ...snapshot, customers, transactions } : snapshot;
}

function saveSnapshot(snapshot: Snapshot) {
  writeJSON(LS_RECORDS, snapshot.records);
  writeJSON(LS_CUSTOMERS, snapshot.customers);
  writeJSON(LS_TRANSACTIONS, snapshot.transactions);
  writeJSON(LS_SETTINGS, snapshot.settings);
}

function getLastServerSnapshot(): Snapshot {
  return readJSON<Snapshot>(LAST_SERVER_SNAPSHOT_KEY, {
    records: [], customers: [], transactions: [], settings: {},
  });
}

function saveLastServerSnapshot(snapshot: Snapshot) {
  try {
    localStorage.setItem(LAST_SERVER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {}
}

async function apiJoinShop(code: string): Promise<{
  id: string; code: string; name: string; isNew: boolean;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/shop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.toUpperCase() }),
    });
    if (!res.ok) {
      let message = `Server error (${res.status})`;
      try {
        const body = await res.json() as { error?: string };
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }
    return res.json();
  } catch {
    return null;
  }
}

async function apiGetData(code: string): Promise<ServerResponse> {
  const res = await fetch(`${API_BASE}/shop/${code.toUpperCase()}/data`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Unable to fetch shop data");
  return res.json();
}

async function apiPushData(
  code: string,
  snapshot: Snapshot,
  base: Snapshot,
): Promise<ServerResponse> {
  const res = await fetch(`${API_BASE}/shop/${code.toUpperCase()}/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...snapshot, base }),
  });
  if (!res.ok) throw new Error("Push failed");
  return res.json();
}

function markSynced(updatedAt: string) {
  localStorage.setItem(LAST_SERVER_AT_KEY, updatedAt);
  const timeStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
  localStorage.setItem(LAST_SYNC_KEY, timeStr);
  return timeStr;
}

export function useSync() {
  const [shopCode, setShopCode] = useState<string>(
    () => localStorage.getItem(SHOP_CODE_KEY) ?? "",
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    localStorage.getItem(SHOP_CODE_KEY) ? "idle" : "not-setup",
  );
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    () => localStorage.getItem(LAST_SYNC_KEY) ?? "",
  );

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushInFlightRef = useRef<Promise<boolean> | null>(null);
  const pushToServerRef = useRef<(code: string) => Promise<boolean>>(
    async () => false,
  );
  const isOnline = useRef(navigator.onLine);
  const isSyncApplyingRef = useRef(false);

  useEffect(() => {
    const onOnline = () => {
      isOnline.current = true;
      const code = localStorage.getItem(SHOP_CODE_KEY);
      if (code) {
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => { void pushToServerRef.current(code); }, 300);
      }
    };
    const onOffline = () => {
      isOnline.current = false;
      setSyncStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const pullFromServer = useCallback(async (code: string) => {
    if (!isOnline.current) {
      setSyncStatus("offline");
      return;
    }

    try {
      setSyncStatus("syncing");
      const data = await apiGetData(code);
      const serverSnapshot: Snapshot = {
        records: data.records ?? [],
        customers: data.customers ?? [],
        transactions: data.transactions ?? [],
        settings: data.settings ?? {},
      };

      const lastAt = localStorage.getItem(LAST_SERVER_AT_KEY);
      const baseline = getLastServerSnapshot();
      const local = getLocalSnapshot();

      if (lastAt && lastAt === data.updatedAt && snapshotEquals(local, baseline)) {
        setSyncStatus("synced");
        return;
      }

      // Never blindly overwrite unsynced local changes. Push them through the
      // server's three-way merge first; that merge carries deletions too.
      if (lastAt && !snapshotEquals(local, baseline)) {
        await pushToServerRef.current(code);
        return;
      }

      // First load after joining an existing shop: server is authoritative.
      isSyncApplyingRef.current = true;
      saveSnapshot(serverSnapshot);
      saveLastServerSnapshot(serverSnapshot);
      isSyncApplyingRef.current = false;

      const timeStr = markSynced(data.updatedAt);
      setLastSyncTime(timeStr);
      setSyncStatus("synced");
    } catch {
      isSyncApplyingRef.current = false;
      setSyncStatus("error");
    }
  }, []);

  const pushToServer = useCallback(async (code: string): Promise<boolean> => {
    if (pushInFlightRef.current) return pushInFlightRef.current;

    const promise = (async () => {
      if (!isOnline.current) {
        setSyncStatus("offline");
        return false;
      }

      try {
        setSyncStatus("syncing");

        const rawSnapshot = getLocalSnapshot();
        const localSnapshot = reconcileKhataSnapshot(rawSnapshot);
        if (!snapshotEquals(rawSnapshot, localSnapshot)) {
          isSyncApplyingRef.current = true;
          saveSnapshot(localSnapshot);
          isSyncApplyingRef.current = false;
        }

        // CRITICAL: send the last known server snapshot as `base`.
        // Without this, the server cannot tell a deletion from an old device.
        const base = getLastServerSnapshot();
        const beforePush = getLocalSnapshot();
        const result = await apiPushData(code, localSnapshot, base);
        const mergedSnapshot: Snapshot = {
          records: result.records ?? [],
          customers: result.customers ?? [],
          transactions: result.transactions ?? [],
          settings: result.settings ?? {},
        };

        const afterPush = getLocalSnapshot();
        const changedDuringPush = !snapshotEquals(afterPush, beforePush);

        if (!changedDuringPush) {
          saveLastServerSnapshot(mergedSnapshot);
          isSyncApplyingRef.current = true;
          saveSnapshot(mergedSnapshot);
          isSyncApplyingRef.current = false;

          const timeStr = markSynced(result.updatedAt);
          setLastSyncTime(timeStr);
          setSyncStatus("synced");
        } else {
          // A user changed data while the request was in flight. Keep the
          // previous baseline so the next three-way merge can preserve both
          // the server's just-merged changes and the new local change.
          setSyncStatus("syncing");
          if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
          pushTimerRef.current = setTimeout(() => { void pushToServerRef.current(code); }, 300);
        }

        return true;
      } catch {
        isSyncApplyingRef.current = false;
        setSyncStatus("error");
        return false;
      }
    })();

    pushInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (pushInFlightRef.current === promise) pushInFlightRef.current = null;
    }
  }, []);

  pushToServerRef.current = pushToServer;

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (isSyncApplyingRef.current) return;
      const watchKeys = [LS_RECORDS, LS_CUSTOMERS, LS_TRANSACTIONS, LS_SETTINGS];
      if (!watchKeys.includes(e.key ?? "")) return;
      const code = localStorage.getItem(SHOP_CODE_KEY);
      if (!code) return;

      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => { void pushToServer(code); }, 1500);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [pushToServer]);

  useEffect(() => {
    const code = localStorage.getItem(SHOP_CODE_KEY);
    if (!code) return;

    const syncExistingShop = async () => {
      const baselineAt = localStorage.getItem(LAST_SERVER_AT_KEY);
      if (!baselineAt) {
        await pullFromServer(code);
      } else {
        const pushed = await pushToServer(code);
        if (pushed) await pullFromServer(code);
      }
    };

    void syncExistingShop();
    const interval = setInterval(() => { void pullFromServer(code); }, 30000);
    return () => clearInterval(interval);
  }, [shopCode, pullFromServer, pushToServer]);

  const setupShop = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase().slice(0, 8);
    if (trimmed.length < 4) {
      return { success: false, isNew: false, error: "Code 4 se 8 letters ka hona chahiye" };
    }

    let result: Awaited<ReturnType<typeof apiJoinShop>>;
    try {
      result = await apiJoinShop(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error";
      return { success: false, isNew: false, error: message };
    }
    if (!result) {
      return { success: false, isNew: false, error: "Server se connection nahi ho pa raha. Internet check karein." };
    }

    localStorage.setItem(SHOP_CODE_KEY, trimmed);
    setShopCode(trimmed);

    if (!result.isNew) {
      localStorage.removeItem(LAST_SERVER_AT_KEY);
      localStorage.removeItem(LAST_SERVER_SNAPSHOT_KEY);
      await pullFromServer(trimmed);
    } else {
      const emptyBase: Snapshot = { records: [], customers: [], transactions: [], settings: {} };
      saveLastServerSnapshot(emptyBase);
      localStorage.removeItem(LAST_SERVER_AT_KEY);
      const pushed = await pushToServer(trimmed);
      if (!pushed) {
        return { success: false, isNew: true, error: "Shop ban gaya, lekin data server par nahi pahucha. Abhi Sync dobara karein." };
      }
    }

    return { success: true, isNew: result.isNew };
  }, [pullFromServer, pushToServer]);

  const syncNow = useCallback(async () => {
    const code = localStorage.getItem(SHOP_CODE_KEY);
    if (!code) return;
    const pushed = await pushToServer(code);
    if (pushed) await pullFromServer(code);
  }, [pullFromServer, pushToServer]);

  const disconnectShop = useCallback(() => {
    localStorage.removeItem(SHOP_CODE_KEY);
    localStorage.removeItem(LAST_SERVER_AT_KEY);
    localStorage.removeItem(LAST_SERVER_SNAPSHOT_KEY);
    setShopCode("");
    setSyncStatus("not-setup");
  }, []);

  return { shopCode, syncStatus, lastSyncTime, setupShop, syncNow, disconnectShop };
}
